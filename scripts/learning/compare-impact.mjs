import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const groups = {
  lessons: ['course_id', 'lesson_id'],
  attribution: ['course_id'],
  completion: ['course_id'],
  enrollment_readiness: ['course_id', 'user_id'],
};
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
function index(report, group, keys) {
  if (report?.report_version !== 2 || !['local_post_migration_snapshot','local_pre_migration_snapshot'].includes(report.scope) || !Array.isArray(report[group])) throw new Error(`Invalid v2 snapshot: ${group}`);
  const rows = new Map();
  for (const row of report[group]) {
    if (!row || keys.some(key => typeof row[key] !== 'string' || !row[key])) throw new Error(`Missing identity in ${group}`);
    const id = JSON.stringify(keys.map(key => row[key]));
    if (rows.has(id)) throw new Error(`Duplicate identity in ${group}: ${id}`);
    // Validator issue order is not meaningful; instructor order remains meaningful.
    rows.set(id, canonical(group === 'lessons' && Array.isArray(row.issues) ? { ...row, issues: [...row.issues].sort() } : row));
  }
  return rows;
}
export function compareImpact(before, after) {
  const result = { report_version: 1, snapshot_version: 2, changes: {}, history_changes: [] };
  for (const [group, keys] of Object.entries({ ...groups, ...(before.permissions || after.permissions ? { permissions: ['course_id','user_id'] } : {}) })) {
    const oldRows = index(before, group, keys), newRows = index(after, group, keys);
    const changes = [];
    for (const id of [...new Set([...oldRows.keys(), ...newRows.keys()])].sort()) {
      const old = oldRows.get(id), next = newRows.get(id);
      if (JSON.stringify(old) === JSON.stringify(next)) continue;
      const identity = Object.fromEntries(keys.map(key => [key, (next ?? old)[key]]));
      changes.push({ ...identity, status: !old ? 'added' : !next ? 'removed' : 'changed', before: old ?? null, after: next ?? null });
      if (group === 'enrollment_readiness' && old) {
        for (const field of ['completed_at', 'certificate_issued_at']) {
          if (old[field] != null && old[field] !== next?.[field]) result.history_changes.push({ ...identity, field, before: old[field], after: next?.[field] ?? null });
        }
      }
    }
    result.changes[group] = changes;
  }
  result.summary = Object.fromEntries(Object.entries(result.changes).map(([group, changes]) => [group, changes.length]));
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [, , before, after, ...extra] = process.argv;
    if (!before || !after || extra.length) throw new Error('Usage: node scripts/learning/compare-impact.mjs BEFORE.json AFTER.json');
    process.stdout.write(JSON.stringify(compareImpact(JSON.parse(readFileSync(before, 'utf8')), JSON.parse(readFileSync(after, 'utf8'))), null, 2) + '\n');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
