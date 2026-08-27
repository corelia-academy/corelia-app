import { createHash } from "node:crypto";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PRODUCTION_PROJECT_REF = "lawhkvyyoznwygzsycan";
export const STAGING_PROJECT_REF = "opoozbmfbezkrpzxsusx";
export const PRODUCTION_SUPABASE_URL = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;
export const ALLOWED_PRODUCTION_CDN_URLS = new Set([
  "https://cdn.corelia.academy",
  "https://cdn.corelia.academy/storage/v1/object/public/cdn",
]);

function fail(message) {
  throw new Error(`Production frontend artifact verification failed: ${message}`);
}

function normalizeRequiredUrl(rawValue, label) {
  const value = rawValue?.trim();
  if (!value) fail(`${label} is missing`);

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label} is not a valid URL`);
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
    fail(`${label} must be an HTTPS URL without credentials, query parameters, or fragments`);
  }

  return parsed.toString().replace(/\/$/, "");
}

async function listArtifactFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join("/");
    const metadata = await lstat(absolutePath);

    if (metadata.isSymbolicLink()) fail(`symbolic links are not allowed: ${relativePath}`);
    if (metadata.isDirectory()) {
      files.push(...await listArtifactFiles(rootDir, absolutePath));
    } else if (metadata.isFile()) {
      files.push({ absolutePath, relativePath });
    } else {
      fail(`unsupported artifact entry: ${relativePath}`);
    }
  }

  return files;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function verifyProductionFrontendArtifact({
  distDir,
  expectedSupabaseUrl,
  expectedCdnUrl,
  expectedAppVersion,
}) {
  const normalizedSupabaseUrl = normalizeRequiredUrl(expectedSupabaseUrl, "expected Production Supabase URL");
  if (normalizedSupabaseUrl !== PRODUCTION_SUPABASE_URL) {
    fail(`expected Supabase URL must target ${PRODUCTION_PROJECT_REF}`);
  }

  const normalizedCdnUrl = normalizeRequiredUrl(expectedCdnUrl, "expected Production CDN URL");
  if (!ALLOWED_PRODUCTION_CDN_URLS.has(normalizedCdnUrl)) {
    fail("expected CDN URL is not an approved Corelia Production CDN target");
  }

  const version = expectedAppVersion?.trim();
  if (!version) fail("expected app version is missing");

  const resolvedDistDir = path.resolve(distDir);
  let distMetadata;
  try {
    distMetadata = await lstat(resolvedDistDir);
  } catch {
    fail(`artifact directory does not exist: ${resolvedDistDir}`);
  }
  if (!distMetadata.isDirectory() || distMetadata.isSymbolicLink()) {
    fail("artifact path must be a real directory");
  }

  const files = (await listArtifactFiles(resolvedDistDir)).sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, "en"),
  );
  if (files.length === 0) fail("artifact directory is empty");
  if (!files.some(({ relativePath }) => relativePath === "index.html")) {
    fail("artifact is missing index.html");
  }

  const expectedSupabaseBytes = Buffer.from(normalizedSupabaseUrl, "utf8");
  const productionRefBytes = Buffer.from(PRODUCTION_PROJECT_REF, "utf8");
  const stagingRefBytes = Buffer.from(STAGING_PROJECT_REF, "utf8");
  const expectedCdnBytes = Buffer.from(normalizedCdnUrl, "utf8");
  const versionBytes = Buffer.from(version, "utf8");
  const buildMarkerBytes = Buffer.from("__CORELIA_BUILD__", "utf8");

  let hasExpectedSupabaseUrl = false;
  let hasProductionRef = false;
  let hasStagingRef = false;
  let hasExpectedCdnUrl = false;
  let hasExpectedVersion = false;
  let hasBuildMarker = false;
  const fileHashes = [];

  for (const file of files) {
    const contents = await readFile(file.absolutePath);
    const fileHash = sha256(contents);
    fileHashes.push({ path: file.relativePath, sha256: fileHash, size: contents.byteLength });

    hasExpectedSupabaseUrl ||= contents.includes(expectedSupabaseBytes);
    hasProductionRef ||= contents.includes(productionRefBytes);
    hasStagingRef ||= contents.includes(stagingRefBytes);
    hasExpectedCdnUrl ||= contents.includes(expectedCdnBytes);
    hasExpectedVersion ||= contents.includes(versionBytes);
    hasBuildMarker ||= contents.includes(buildMarkerBytes);
  }

  if (!hasExpectedSupabaseUrl || !hasProductionRef) {
    fail("artifact does not contain the exact Production Supabase target");
  }
  if (hasStagingRef) fail("artifact contains the Staging Supabase project ref");
  if (!hasExpectedCdnUrl) fail("artifact does not contain the expected Production CDN target");
  if (!hasExpectedVersion || !hasBuildMarker) {
    fail("artifact does not contain the expected app version and Corelia build marker");
  }

  const artifactIdentity = fileHashes
    .map((file) => `${file.path}\0${file.sha256}\0${file.size}\n`)
    .join("");

  return {
    status: "PRODUCTION_FRONTEND_ARTIFACT_VERIFIED",
    supabaseProjectRef: PRODUCTION_PROJECT_REF,
    supabaseUrl: normalizedSupabaseUrl,
    cdnOrigin: normalizedCdnUrl,
    appVersion: version,
    fileCount: fileHashes.length,
    artifactSha256: sha256(Buffer.from(artifactIdentity, "utf8")),
    files: fileHashes,
  };
}

async function runCli() {
  const distDir = process.argv[2];
  const reportPath = process.argv[3];
  if (!distDir || !reportPath) {
    fail("usage: node verify-production-frontend-artifact.mjs <dist-dir> <report-json>");
  }

  const packageJsonPath = fileURLToPath(new URL("../../package.json", import.meta.url));
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const report = await verifyProductionFrontendArtifact({
    distDir,
    expectedSupabaseUrl: process.env.EXPECTED_PRODUCTION_SUPABASE_URL,
    expectedCdnUrl: process.env.EXPECTED_PRODUCTION_CDN_URL,
    expectedAppVersion: packageJson.version,
  });

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`PRODUCTION_FRONTEND_ARTIFACT_VERIFIED sha256=${report.artifactSha256} files=${report.fileCount}\n`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
