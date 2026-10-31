// Backfills missing cover thumbnails for published AI courses.
// Default mode is dry-run, which inspects eligible courses and prints the planned cover (logo/text)
// without modifying storage or the database.
//
// Usage:
//   # Dry-run on local database
//   eval "$(npx supabase status -o env)" && SUPABASE_URL=$API_URL SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
//     deno run -A --config supabase/functions/corelia-api/deno.json scripts/studio/backfill-covers.ts
//
//   # Apply changes on local database
//   eval "$(npx supabase status -o env)" && SUPABASE_URL=$API_URL SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
//     deno run -A --config supabase/functions/corelia-api/deno.json scripts/studio/backfill-covers.ts --apply
//
//   # Targeted backfill for a single course
//   ... deno run -A --config supabase/functions/corelia-api/deno.json scripts/studio/backfill-covers.ts --apply --course-id <UUID>
//
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

import {
  appCoverPath,
  appCoverUrl,
  COVER_BUCKET,
  isSystemCover,
  renderCoverPng,
  resolveCoverPlan,
} from "../../supabase/functions/corelia-api/studio/cover.tsx";

const url = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  Deno.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const isApply = Deno.args.includes("--apply");
const courseIdArgIdx = Deno.args.indexOf("--course-id");
const courseIdFromFlag = courseIdArgIdx !== -1 ? Deno.args[courseIdArgIdx + 1] : undefined;
const courseIdFromEqual = Deno.args.find((a) => a.startsWith("--course-id="))?.split("=")[1];
const targetCourseId = courseIdFromFlag ?? courseIdFromEqual;

console.log(`=== Backfill AI Course Cover Thumbnails ===`);
console.log(`Mode: ${isApply ? "APPLY (writes will be performed)" : "DRY-RUN (read-only preview)"}`);
if (targetCourseId) {
  console.log(`Target Course Filter: ${targetCourseId}`);
}
console.log("--------------------------------------------");

async function main() {
  // 1. Identify studio courses to verify AI-generated origin
  const { data: studioRows, error: studioErr } = await db
    .from("studio_courses")
    .select("id, title, status");

  if (studioErr) {
    console.warn(`Warning: failed to query studio_courses (${studioErr.message}), will rely solely on courses.data.course_type`);
  }

  const studioMap = new Map<string, { title: string; status: string }>();
  for (const s of studioRows ?? []) {
    studioMap.set(s.id, { title: s.title, status: s.status });
  }

  // 2. Query published courses
  let query = db
    .from("courses")
    .select("id, slug, published, data")
    .eq("published", true);

  if (targetCourseId) {
    query = query.eq("id", targetCourseId);
  }

  const { data: courses, error: coursesErr } = await query;
  if (coursesErr) {
    console.error(`Error querying courses: ${coursesErr.message}`);
    Deno.exit(1);
  }

  // Filter for AI-generated courses with empty thumbnail_url
  const eligibleCourses = (courses ?? []).filter((c) => {
    const data = (c.data ?? {}) as Record<string, unknown>;
    const isAi = data.course_type === "ai_generated" || studioMap.has(c.id);
    const thumb = (data.thumbnail_url as string | undefined)?.trim() ?? "";
    return isAi && thumb === "";
  });

  console.log(`Found ${courses?.length ?? 0} published course(s) in total.`);
  console.log(`Eligible published AI course(s) with empty thumbnail: ${eligibleCourses.length}`);
  console.log("--------------------------------------------");

  if (eligibleCourses.length === 0) {
    console.log("No courses need backfill.");
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const course of eligibleCourses) {
    const data = (course.data ?? {}) as Record<string, unknown>;
    const title = (data.title as string | undefined) ?? studioMap.get(course.id)?.title ?? course.slug;

    console.log(`\nCourse: ${course.id}`);
    console.log(`  Title: "${title}"`);
    console.log(`  Slug: ${course.slug}`);

    try {
      // Fetch paths associated with this studio course
      const { data: pathRows, error: pathErr } = await db
        .from("studio_course_paths")
        .select("learning_order, studio_paths(title)")
        .eq("course_id", course.id)
        .order("learning_order", { ascending: true });

      if (pathErr) {
        console.warn(`  Warning fetching paths: ${pathErr.message}`);
      }

      const paths = (pathRows ?? []).map((r: any) => ({
        title: r.studio_paths?.title ?? "",
        learning_order: r.learning_order ?? 0,
      }));

      if (paths.length > 0) {
        console.log(`  Paths (${paths.length}): ${paths.map((p) => `"${p.title}" (#${p.learning_order})`).join(", ")}`);
      } else {
        console.log(`  Paths: none found`);
      }

      const plan = await resolveCoverPlan(title, paths);

      if (plan.kind === "logo") {
        console.log(`  Plan: LOGO (count: ${plan.logos.length}, names: ${plan.logos.map((l) => l.name).join(", ")})`);
      } else {
        console.log(`  Plan: TEXT FALLBACK ("${plan.text}")`);
      }

      if (isApply) {
        console.log(`  Rendering PNG (1200x675)...`);
        const png = await renderCoverPng(plan);
        const coverPath = appCoverPath(course.id);

        console.log(`  Uploading to storage: ${COVER_BUCKET}/${coverPath}...`);
        const put = await db.storage.from(COVER_BUCKET).upload(coverPath, png, {
          contentType: "image/png",
          upsert: true,
        });

        if (put.error) {
          throw new Error(`Storage upload failed: ${put.error.message}`);
        }

        const coverUrl = appCoverUrl(db, course.id);
        console.log(`  Updating course record with thumbnail_url: ${coverUrl}...`);

        // Re-read latest course data right before writing to avoid overwriting concurrent changes
        const { data: latestCourse } = await db
          .from("courses")
          .select("data")
          .eq("id", course.id)
          .maybeSingle();

        const latestData = (latestCourse?.data ?? {}) as Record<string, unknown>;
        const currentThumb = (latestData.thumbnail_url as string | undefined)?.trim() ?? "";
        if (currentThumb !== "" && !isSystemCover(currentThumb, course.id)) {
          console.log(`  [SKIPPED] Course ${course.id} was updated with manual artwork, skipping.`);
          continue;
        }

        const { error: updateErr } = await db
          .from("courses")
          .update({
            data: { ...latestData, thumbnail_url: coverUrl },
          })
          .eq("id", course.id);

        if (updateErr) {
          throw new Error(`Database update failed: ${updateErr.message}`);
        }

        console.log(`  [OK] Successfully backfilled course ${course.id}`);
        successCount++;
      } else {
        console.log(`  [DRY-RUN] Would generate and set thumbnail: ${appCoverUrl(db, course.id)}`);
      }
    } catch (err: any) {
      console.error(`  [ERROR] Failed to process course ${course.id}: ${err?.message ?? err}`);
      errorCount++;
    }
  }

  console.log("\n============================================");
  console.log(`Summary:`);
  console.log(`  Eligible courses: ${eligibleCourses.length}`);
  if (isApply) {
    console.log(`  Successfully updated: ${successCount}`);
    console.log(`  Errors: ${errorCount}`);
  } else {
    console.log(`  Dry-run completed. Re-run with --apply to execute changes.`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  Deno.exit(1);
});
