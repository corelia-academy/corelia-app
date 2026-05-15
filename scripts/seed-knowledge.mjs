#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SOURCE = "corelia-seed-script";

function readEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function requireEnv(...names) {
  const value = readEnv(...names);
  if (value) return value;
  throw new Error(`Missing env: ${names.join(" | ")}`);
}

function createServiceClient() {
  const url = requireEnv("CORELIA_SUPABASE_URL", "SUPABASE_URL", "VITE_SUPABASE_URL");
  const key = requireEnv(
    "CORELIA_SUPABASE_SECRET_KEYS",
    "SUPABASE_SECRET_KEYS",
    "SUPABASE_SERVICE_ROLE_KEY",
  );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function toSentenceList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function chunkContent(parts) {
  return parts.map((part) => part.trim()).filter(Boolean).join("\n\n");
}

async function fetchPublishedCourses(db) {
  const { data, error } = await db
    .from("courses")
    .select("id,slug,published,data,updated_at")
    .eq("published", true)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchLessonsForCourses(db, courseIds) {
  if (!courseIds.length) return [];
  const { data, error } = await db
    .from("course_lessons")
    .select("id,course_id,data")
    .in("course_id", courseIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchCareerTracks(db) {
  const { data, error } = await db
    .from("career_tracks")
    .select("id,slug,published,title,description,what_youll_learn,prerequisites,updated_at")
    .eq("published", true)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchPublicHackathons(db) {
  const { data, error } = await db
    .from("hackathons")
    .select("id,status,document,updated_at")
    .in("status", ["published", "running", "ended"])
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchPublicProjects(db) {
  const { data, error } = await db
    .from("projects")
    .select(
      "id,title,summary,visibility,source_type,source_id,demo_url,repo_url,slide_url,video_url,updated_at",
    )
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function buildCourseChunks(courseRows) {
  return courseRows.map((row) => {
    const data = row.data ?? {};
    const title = String(data.title ?? "").trim() || `Course ${row.id}`;
    const description =
      String(data.short_description ?? "").trim() ||
      String(data.description ?? "").trim() ||
      "No description provided.";
    const prerequisites = toSentenceList(data.prerequisites);
    const tags = toSentenceList(data.tags);
    const track = String(data.track ?? "").trim() || null;

    return {
      topic: title,
      subtopic: tags.slice(0, 3).join(", ") || null,
      content: chunkContent([
        `Course: ${title}`,
        `Slug: ${String(row.slug ?? "").trim() || "n/a"}`,
        `Description: ${description}`,
        prerequisites.length ? `Prerequisites: ${prerequisites.join("; ")}` : "",
        tags.length ? `Tags: ${tags.join(", ")}` : "",
        track ? `Track: ${track}` : "",
      ]),
      source: SOURCE,
      track,
      content_category: "course_catalog",
    };
  });
}

function buildLessonChunks(courseRows, lessonRows) {
  const courseTitleById = new Map();
  for (const row of courseRows) {
    const data = row.data ?? {};
    courseTitleById.set(
      row.id,
      String(data.title ?? "").trim() || `Course ${row.id}`,
    );
  }

  return lessonRows.map((row) => {
    const data = row.data ?? {};
    const lessonTitle = String(data.title ?? "").trim() || `Lesson ${row.id}`;
    const topic =
      String(data.topic ?? "").trim() ||
      String(data.subtopic ?? "").trim() ||
      lessonTitle;
    const subtopic =
      String(data.subtopic ?? "").trim() ||
      String(data.short_description ?? "").trim().slice(0, 80) ||
      null;
    const shortDescription = String(data.short_description ?? "").trim();
    const markdown = String(data.description_markdown ?? "").trim();
    const youtubeUrl = String(data.youtube_url ?? "").trim();
    const courseTitle = courseTitleById.get(row.course_id) || `Course ${row.course_id}`;

    return {
      topic,
      subtopic,
      content: chunkContent([
        `Lesson: ${lessonTitle}`,
        `Course: ${courseTitle}`,
        shortDescription ? `Summary: ${shortDescription}` : "",
        markdown ? `Details: ${markdown.slice(0, 1200)}` : "",
        youtubeUrl ? `Video source: ${youtubeUrl}` : "",
      ]),
      source: SOURCE,
      track: courseTitle,
      content_category: "lesson",
    };
  });
}

function buildCareerTrackChunks(trackRows) {
  return trackRows.map((row) => {
    const title = String(row.title ?? "").trim() || `Career track ${row.id}`;
    const description = String(row.description ?? "").trim() || "No description provided.";
    const learn = toSentenceList(row.what_youll_learn);
    const prerequisites = toSentenceList(row.prerequisites);

    return {
      topic: title,
      subtopic: String(row.slug ?? "").trim() || null,
      content: chunkContent([
        `Career track: ${title}`,
        `Description: ${description}`,
        learn.length ? `What you'll learn: ${learn.join("; ")}` : "",
        prerequisites.length ? `Prerequisites: ${prerequisites.join("; ")}` : "",
      ]),
      source: SOURCE,
      track: String(row.slug ?? "").trim() || null,
      content_category: "career_track",
    };
  });
}

function buildPlatformGuideChunks() {
  return [
    {
      topic: "How to use Cora in Corelia",
      subtopic: "platform_guide",
      content: chunkContent([
        "Cora can help learners understand progress, choose next courses, and clarify lessons.",
        "Dashboard is best for progress summaries and next-step planning.",
        "Course and lesson surfaces are best for contextual tutoring and practice follow-up questions.",
        "Search and course discovery surfaces are best for narrowing course choices by goal, level, and interests.",
      ]),
      source: SOURCE,
      track: null,
      content_category: "platform_guide",
    },
    {
      topic: "How to ask better learning questions",
      subtopic: "platform_guide",
      content: chunkContent([
        "Short questions are fine, but more context usually leads to better answers.",
        "Mention your current goal, level, and what you already tried if you want stronger guidance.",
        "For lesson tutoring, include what part feels confusing or where you got stuck.",
      ]),
      source: SOURCE,
      track: null,
      content_category: "platform_guide",
    },
  ];
}

function buildActivityChunks(hackathonRows, projectRows) {
  const hackathonChunks = hackathonRows.map((row) => {
    const document = row.document ?? {};
    const title = String(document.title ?? "").trim() || `Hackathon ${row.id}`;
    const tagline = String(document.tagline ?? "").trim();
    const description = String(document.description ?? "").trim();
    const prizeSummary = String(document.prize_pool_summary ?? "").trim();
    const relatedTracks = Array.isArray(document.relatedCareerTrackIds)
      ? document.relatedCareerTrackIds.map((item) => String(item ?? "").trim()).filter(Boolean)
      : Array.isArray(document.related_career_track_ids)
        ? document.related_career_track_ids.map((item) => String(item ?? "").trim()).filter(Boolean)
        : [];
    const tracks = Array.isArray(document.tracks)
      ? document.tracks
          .map((track) => String(track?.title ?? track?.id ?? "").trim())
          .filter(Boolean)
      : [];

    return {
      topic: title,
      subtopic: "hackathon",
      content: chunkContent([
        `Activity: ${title}`,
        tagline ? `Tagline: ${tagline}` : "",
        description ? `Description: ${description}` : "",
        prizeSummary ? `Prize pool: ${prizeSummary}` : "",
        tracks.length ? `Tracks: ${tracks.join(", ")}` : "",
        relatedTracks.length ? `Related career tracks: ${relatedTracks.join(", ")}` : "",
        `Status: ${String(row.status ?? "").trim() || "unknown"}`,
      ]),
      source: SOURCE,
      track: tracks[0] || relatedTracks[0] || null,
      content_category: "activity",
    };
  });

  const projectChunks = projectRows.map((row) => {
    const title = String(row.title ?? "").trim() || `Project ${row.id}`;
    const summary = String(row.summary ?? "").trim();
    const sourceType = String(row.source_type ?? "").trim() || "independent";
    const links = [
      row.demo_url ? "demo" : "",
      row.repo_url ? "repo" : "",
      row.slide_url ? "slides" : "",
      row.video_url ? "video" : "",
    ].filter(Boolean);

    return {
      topic: title,
      subtopic: "project",
      content: chunkContent([
        `Activity: ${title}`,
        summary ? `Summary: ${summary}` : "",
        `Source type: ${sourceType}`,
        row.source_id ? `Source id: ${String(row.source_id).trim()}` : "",
        links.length ? `Available links: ${links.join(", ")}` : "",
      ]),
      source: SOURCE,
      track: null,
      content_category: "activity",
    };
  });

  return [...hackathonChunks, ...projectChunks];
}

async function replaceSeededChunks(db, chunks) {
  const categories = Array.from(new Set(chunks.map((chunk) => chunk.content_category)));
  if (categories.length === 0) return;

  const { error: deleteError } = await db
    .from("knowledge_chunks")
    .delete()
    .eq("source", SOURCE)
    .in("content_category", categories);
  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await db.from("knowledge_chunks").insert(chunks);
  if (insertError) throw new Error(insertError.message);
}

async function main() {
  const shouldWrite = process.argv.includes("--write");
  const db = createServiceClient();

  const [courses, careerTracks, hackathons, projects] = await Promise.all([
    fetchPublishedCourses(db),
    fetchCareerTracks(db),
    fetchPublicHackathons(db),
    fetchPublicProjects(db),
  ]);
  const lessons = await fetchLessonsForCourses(
    db,
    courses.map((course) => course.id),
  );

  const chunks = [
    ...buildCourseChunks(courses),
    ...buildLessonChunks(courses, lessons),
    ...buildCareerTrackChunks(careerTracks),
    ...buildActivityChunks(hackathons, projects),
    ...buildPlatformGuideChunks(),
  ];

  const byCategory = chunks.reduce((acc, chunk) => {
    acc[chunk.content_category] = (acc[chunk.content_category] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        mode: shouldWrite ? "write" : "dry-run",
        source: SOURCE,
        totalChunks: chunks.length,
        byCategory,
      },
      null,
      2,
    ),
  );

  if (!shouldWrite) {
    console.log("\nDry run only. Re-run with --write to replace seeded knowledge chunks.");
    return;
  }

  await replaceSeededChunks(db, chunks);
  console.log("\nSeeded knowledge_chunks successfully.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
