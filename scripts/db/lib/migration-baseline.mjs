import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export const MIGRATION_FILE_PATTERN = /^(?<version>\d{14})_(?<name>[a-z0-9][a-z0-9_]*[a-z0-9])\.sql$/;

export function normalizeLineEndings(value) {
  const text = typeof value === "string" ? value : value.toString("utf8");
  return text.replaceAll("\r\n", "\n");
}

export function sha256(value) {
  return createHash("sha256").update(normalizeLineEndings(value)).digest("hex");
}

export function migrationDirectory(projectRoot) {
  return join(resolve(projectRoot), "supabase", "migrations");
}

export function listMigrationFiles(projectRoot) {
  const directory = migrationDirectory(projectRoot);
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => {
      const match = entry.name.match(MIGRATION_FILE_PATTERN);
      const absolutePath = join(directory, entry.name);
      return {
        fileName: entry.name,
        path: relative(resolve(projectRoot), absolutePath).replaceAll("\\", "/"),
        version: match?.groups?.version ?? null,
        name: match?.groups?.name ?? null,
        sha256: sha256(readFileSync(absolutePath)),
      };
    })
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
}

export function createMigrationBaseline(projectRoot, { commitSha, generatedAt }) {
  const migrations = listMigrationFiles(projectRoot);
  const invalid = migrations.filter((migration) => !migration.version);
  if (invalid.length > 0) {
    throw new Error(`Cannot freeze malformed migration filenames: ${invalid.map((migration) => migration.fileName).join(", ")}`);
  }

  const duplicateVersions = findDuplicateVersions(migrations);
  if (duplicateVersions.length > 0) {
    throw new Error(`Cannot freeze duplicate migration versions: ${duplicateVersions.join(", ")}`);
  }

  const latest = migrations.at(-1);
  return {
    schemaVersion: 1,
    generatedAt,
    repository: {
      commitSha,
      migrationDirectory: "supabase/migrations",
    },
    frozenMigrationCount: migrations.length,
    latestMigration: {
      version: latest.version,
      fileName: latest.fileName,
    },
    migrations,
  };
}

export function findDuplicateVersions(migrations) {
  const seen = new Map();
  for (const migration of migrations) {
    if (!migration.version) continue;
    const files = seen.get(migration.version) ?? [];
    files.push(migration.fileName);
    seen.set(migration.version, files);
  }
  return [...seen.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([version, files]) => `${version} (${files.join(", ")})`);
}

export function validateMigrationBaseline(projectRoot, baseline) {
  const errors = [];
  const migrations = listMigrationFiles(projectRoot);
  const baselineEntries = baseline?.migrations;

  if (!Array.isArray(baselineEntries) || baselineEntries.length === 0) {
    return { ok: false, errors: ["Baseline has no migration entries."], newMigrations: [] };
  }

  for (const migration of migrations) {
    if (!migration.version) {
      errors.push(`Malformed migration filename: ${migration.path}. Expected YYYYMMDDHHMMSS_description.sql.`);
    }
  }

  errors.push(...findDuplicateVersions(migrations).map((duplicate) => `Duplicate migration version: ${duplicate}.`));

  const byPath = new Map(migrations.map((migration) => [migration.path, migration]));
  const baselineByPath = new Map(baselineEntries.map((migration) => [migration.path, migration]));
  const frozenLatest = baseline.latestMigration?.version;

  if (!/^\d{14}$/.test(frozenLatest ?? "")) {
    errors.push("Baseline latestMigration.version is missing or malformed.");
  }

  for (const frozen of baselineEntries) {
    const current = byPath.get(frozen.path);
    if (!current) {
      errors.push(`Released migration missing or renamed: ${frozen.path}. Create a new migration; never rename or delete a released migration.`);
      continue;
    }
    if (current.sha256 !== frozen.sha256) {
      errors.push(`Released migration changed: ${frozen.path}. Expected SHA-256 ${frozen.sha256}, got ${current.sha256}. Create a new migration instead of editing released history.`);
    }
    if (current.version !== frozen.version || current.name !== frozen.name) {
      errors.push(`Released migration identity changed: ${frozen.path}. Create a new migration instead of renaming released history.`);
    }
  }

  const newMigrations = migrations.filter((migration) => !baselineByPath.has(migration.path));
  for (const migration of newMigrations) {
    if (!migration.version) continue;
    if (migration.version <= frozenLatest) {
      errors.push(`New migration ${migration.path} is not newer than frozen baseline ${frozenLatest}. Use a new, later 14-digit version.`);
    }
  }

  return { ok: errors.length === 0, errors, newMigrations };
}

export function loadJson(filePath) {
  if (!existsSync(filePath)) throw new Error(`File does not exist: ${filePath}`);
  return JSON.parse(readFileSync(filePath, "utf8"));
}
