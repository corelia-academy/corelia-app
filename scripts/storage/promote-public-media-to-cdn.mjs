// One-off backfill for public course/hackathon artwork that was uploaded to the
// private `app` bucket with 1-year signed URLs. Copies each referenced object to
// the same path in the public `cdn` bucket, then calls
// public.promote_public_media_to_cdn() (migration 20261023141349) to rewrite the
// stored URLs. Idempotent: existing `cdn` copies are kept, rows already on `cdn`
// are skipped. The `app` originals are left in place.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/storage/promote-public-media-to-cdn.mjs [--dry-run]
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}
const dryRun = process.argv.includes("--dry-run");

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const SIGNED_APP = "/storage/v1/object/sign/app/";

function legacyPath(row, urlKey, pathKey) {
  const stored = row?.[urlKey];
  const path = String(row?.[pathKey] ?? "").trim();
  return typeof stored === "string" && stored.includes(SIGNED_APP) && path ? path : null;
}

const [courses, hackathons] = await Promise.all([
  client.from("courses").select("id, data"),
  client.from("hackathons").select("id, document"),
]);
if (courses.error) throw courses.error;
if (hackathons.error) throw hackathons.error;

const paths = new Set();
for (const course of courses.data) {
  const path = legacyPath(course.data, "thumbnail_url", "thumbnail_path");
  if (path) paths.add(path);
}
for (const hackathon of hackathons.data) {
  for (const [urlKey, pathKey] of [["cover_image_url", "cover_image_path"], ["thumbnail_url", "thumbnail_path"]]) {
    const path = legacyPath(hackathon.document, urlKey, pathKey);
    if (path) paths.add(path);
  }
}

const app = client.storage.from("app");
const cdn = client.storage.from("cdn");
let copied = 0;
for (const path of paths) {
  if (dryRun) {
    console.log(`would copy app/${path} -> cdn/${path}`);
    continue;
  }
  const download = await app.download(path);
  if (download.error) throw new Error(`app/${path}: ${download.error.message}`);
  const { error } = await cdn.upload(path, download.data, {
    contentType: download.data.type || "application/octet-stream",
    upsert: false,
  });
  if (error && !/already exists|duplicate/i.test(error.message ?? "")) {
    throw new Error(`cdn/${path}: ${error.message}`);
  }
  if (!error) copied += 1;
  console.log(`${error ? "kept" : "copied"} cdn/${path}`);
}

if (dryRun) {
  console.log(`${paths.size} legacy object(s); dry run, nothing changed`);
} else {
  const { data, error } = await client.rpc("promote_public_media_to_cdn");
  if (error) throw error;
  console.log(`${paths.size} legacy object(s), ${copied} copied; ${data} stored URL(s) rewritten to cdn`);
}
