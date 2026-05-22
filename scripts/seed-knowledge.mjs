#!/usr/bin/env node

import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { PLATFORM_GUIDE_ENTRIES } from "./cora-platform-guide.mjs";

const SOURCE = "corelia-seed-script";
const EMBEDDING_MODEL = "text-embedding-3-small";
const BODY_CHUNK_SIZE = 900;
const BODY_CHUNK_OVERLAP = 120;

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

function parseCsvArg(flag, fallback) {
  const raw = process.argv.find((item) => item.startsWith(`${flag}=`));
  if (!raw) return fallback;
  return raw
    .slice(flag.length + 1)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLocaleArg() {
  const value = process.argv.find((item) => item.startsWith("--locale="))?.split("=")[1]?.trim();
  if (!value || value === "all") return ["vi", "en"];
  if (value !== "vi" && value !== "en") {
    throw new Error(`Unsupported locale: ${value}`);
  }
  return [value];
}

const ALL_CATEGORIES = [
  "lesson",
  "course_catalog",
  "career_track",
  "activity",
  "platform_guide",
  "credential",
];

function parseCategoryArg() {
  const categories = parseCsvArg("--categories", ALL_CATEGORIES);
  const invalid = categories.filter((item) => !ALL_CATEGORIES.includes(item));
  if (invalid.length > 0) {
    throw new Error(`Unsupported categories: ${invalid.join(", ")}`);
  }
  return categories;
}

function trimText(value) {
  return String(value ?? "").trim();
}

function toSentenceList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => trimText(item)).filter(Boolean);
}

function normalizeWhitespace(value) {
  return trimText(value).replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

function stripMarkdown(value) {
  return normalizeWhitespace(
    trimText(value)
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1 ($2)")
      .replace(/^>\s?/gm, "")
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/[*_~]/g, "")
      .replace(/^\s*[-+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/\n+/g, "\n"),
  );
}

function splitIntoWindows(text, size = BODY_CHUNK_SIZE, overlap = BODY_CHUNK_OVERLAP) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];
  if (normalized.length <= size) return [normalized];

  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + size);
    if (end < normalized.length) {
      const nextBreak = normalized.lastIndexOf("\n", end);
      const sentenceBreak = normalized.lastIndexOf(". ", end);
      const safeBreak = Math.max(nextBreak, sentenceBreak);
      if (safeBreak > start + Math.floor(size * 0.55)) {
        end = safeBreak + 1;
      }
    }
    const piece = normalized.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

function sha(input) {
  return createHash("sha256").update(input).digest("hex");
}

function vectorLiteral(values) {
  return `[${values.join(",")}]`;
}

function contentFromParts(parts) {
  return parts.map((item) => normalizeWhitespace(item)).filter(Boolean).join("\n\n");
}

function localeConfigSupported(config) {
  const supported = Array.isArray(config?.supported_locales) ? config.supported_locales : null;
  const values = supported?.map((item) => (item === "en" ? "en" : "vi")) ?? ["vi", "en"];
  return Array.from(new Set(values));
}

function localeConfigPrimary(config) {
  return config?.primary_content_locale === "en" ? "en" : "vi";
}

function buildLocaleFallback(base, localized, fields) {
  const result = {};
  for (const field of fields) {
    const localizedValue = localized?.[field];
    const baseValue = base?.[field];
    result[field] = localizedValue ?? baseValue ?? null;
  }
  return result;
}

async function fetchPublishedCourses(db) {
  const { data, error } = await db
    .from("courses")
    .select("id,slug,published,updated_at,data")
    .eq("published", true)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchCourseLocales(db, courseIds) {
  if (!courseIds.length) return [];
  const { data, error } = await db
    .from("course_locales")
    .select("course_id,locale,data")
    .in("course_id", courseIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchCourseSections(db, courseIds) {
  if (!courseIds.length) return [];
  const { data, error } = await db
    .from("course_sections")
    .select("id,course_id,sort_order,data")
    .in("course_id", courseIds)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchCourseSectionLocales(db, courseIds) {
  if (!courseIds.length) return [];
  const { data, error } = await db
    .from("course_section_locales")
    .select("course_id,section_id,locale,data")
    .in("course_id", courseIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchLessonsForCourses(db, courseIds) {
  if (!courseIds.length) return [];
  const { data, error } = await db
    .from("course_lessons")
    .select("id,course_id,section_id,sort_order,data")
    .in("course_id", courseIds)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchLessonLocales(db, courseIds) {
  if (!courseIds.length) return [];
  const { data, error } = await db
    .from("course_lesson_locales")
    .select("course_id,lesson_id,locale,data")
    .in("course_id", courseIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchCareerTracks(db) {
  const { data, error } = await db
    .from("career_tracks")
    .select("id,slug,published,title,description,what_youll_learn,prerequisites,owner_scope,instructor_id,i18n,updated_at")
    .eq("published", true)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchCareerTrackLocales(db, trackIds) {
  if (!trackIds.length) return [];
  const { data, error } = await db
    .from("career_track_locales")
    .select("career_track_id,locale,data")
    .in("career_track_id", trackIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchCareerTrackCourses(db, trackIds) {
  if (!trackIds.length) return [];
  const { data, error } = await db
    .from("career_track_courses")
    .select("career_track_id,course_id,sort_order")
    .in("career_track_id", trackIds)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchPublicProfiles(db, ids) {
  if (!ids.length) return [];
  const { data, error } = await db
    .from("public_profiles")
    .select("id,username,ocid")
    .in("id", ids);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchPublicHackathons(db) {
  const { data, error } = await db
    .from("hackathons")
    .select("id,slug,status,document,updated_at")
    .in("status", ["published", "running", "ended"])
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchHackathonLocales(db, hackathonIds) {
  if (!hackathonIds.length) return [];
  const { data, error } = await db
    .from("hackathon_locales")
    .select("hackathon_id,locale,data")
    .in("hackathon_id", hackathonIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchPublicProjects(db) {
  const { data, error } = await db
    .from("projects")
    .select(
      "id,title,summary,visibility,source_type,source_id,demo_url,repo_url,slide_url,video_url,updated_at,i18n,created_at",
    )
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchProjectLocales(db, projectIds) {
  if (!projectIds.length) return [];
  const { data, error } = await db
    .from("project_locales")
    .select("project_id,locale,data")
    .in("project_id", projectIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchActiveCredentialTemplates(db) {
  const { data, error } = await db
    .from("credential_templates")
    .select("id,scope_type,course_id,hackathon_id,hackathon_role,name,description,trigger_type,trigger_rule,is_active,updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

function rowMap(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    map.set(keyFn(row), row);
  }
  return map;
}

function rowGroup(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

function buildChunk({
  contentCategory,
  locale,
  title,
  topic,
  subtopic,
  content,
  track = null,
  sourceTable,
  sourceId,
  sourceUpdatedAt,
  chunkKind,
  chunkIndex = 0,
  metadata = {},
}) {
  const normalizedContent = normalizeWhitespace(content);
  const payload = {
    topic: trimText(topic) || trimText(title) || sourceId,
    subtopic: trimText(subtopic) || null,
    content: normalizedContent,
    source: SOURCE,
    track: trimText(track) || null,
    content_category: contentCategory,
    source_table: sourceTable,
    source_id: String(sourceId),
    source_updated_at: sourceUpdatedAt,
    locale,
    title: trimText(title) || trimText(topic) || String(sourceId),
    chunk_kind: chunkKind,
    chunk_index: chunkIndex,
    metadata,
    embedding_model: null,
    embedded_at: null,
  };
  payload.checksum = sha(
    JSON.stringify({
      topic: payload.topic,
      subtopic: payload.subtopic,
      content: payload.content,
      contentCategory,
      locale,
      sourceTable,
      sourceId,
      chunkKind,
      chunkIndex,
      metadata,
    }),
  );
  return payload;
}

function courseHref(slug, id) {
  return `/courses/${encodeURIComponent(trimText(slug) || trimText(id))}`;
}

function lessonHref(courseId, lessonId) {
  return `/learn/${encodeURIComponent(courseId)}/lesson/${encodeURIComponent(lessonId)}`;
}

function buildCourseChunks(courses, courseLocalesByCourseLocale, requestedLocales) {
  const chunks = [];
  for (const row of courses) {
    const data = row.data ?? {};
    const courseId = String(row.id);
    const locales = localeConfigSupported(data.i18n).filter((locale) => requestedLocales.includes(locale));
    for (const locale of locales) {
      const localized = courseLocalesByCourseLocale.get(`${courseId}:${locale}`)?.data ?? null;
      const merged = buildLocaleFallback(data, localized, [
        "title",
        "description",
        "short_description",
        "learning_outcomes",
        "final_assignment_title",
        "final_assignment_description",
        "final_assignment_instructions",
      ]);
      const title = trimText(merged.title) || `Course ${courseId}`;
      const description = trimText(merged.description);
      const overview = contentFromParts([
        `Course: ${title}`,
        `Slug: ${trimText(row.slug) || "n/a"}`,
        trimText(merged.short_description) ? `Summary: ${trimText(merged.short_description)}` : "",
        description ? `Description: ${description}` : "",
        toSentenceList(merged.learning_outcomes).length
          ? `What you'll learn: ${toSentenceList(merged.learning_outcomes).join("; ")}`
          : "",
        trimText(merged.final_assignment_title)
          ? `Final assignment: ${trimText(merged.final_assignment_title)}`
          : "",
        trimText(merged.final_assignment_description)
          ? `Final assignment summary: ${trimText(merged.final_assignment_description)}`
          : "",
        trimText(merged.final_assignment_instructions)
          ? `Final assignment instructions: ${trimText(merged.final_assignment_instructions)}`
          : "",
      ]);

      chunks.push(
        buildChunk({
          contentCategory: "course_catalog",
          locale,
          title,
          topic: title,
          subtopic: trimText(merged.short_description).slice(0, 120) || trimText(row.slug) || null,
          content: overview,
          track: trimText(data.track) || null,
          sourceTable: "courses",
          sourceId: courseId,
          sourceUpdatedAt: row.updated_at,
          chunkKind: "overview",
          chunkIndex: 0,
          metadata: {
            href: courseHref(row.slug, courseId),
            slug: trimText(row.slug) || null,
            courseId,
          },
        }),
      );

      splitIntoWindows(description).forEach((windowText, index) => {
        chunks.push(
          buildChunk({
            contentCategory: "course_catalog",
            locale,
            title,
            topic: title,
            subtopic: "course body",
            content: contentFromParts([
              `Course: ${title}`,
              `Body section ${index + 1}`,
              windowText,
            ]),
            track: trimText(data.track) || null,
            sourceTable: "courses",
            sourceId: courseId,
            sourceUpdatedAt: row.updated_at,
            chunkKind: "body",
            chunkIndex: index,
            metadata: {
              href: courseHref(row.slug, courseId),
              slug: trimText(row.slug) || null,
              courseId,
            },
          }),
        );
      });
    }
  }
  return chunks;
}

function buildLessonChunks({
  courses,
  courseLocalesByKey,
  sectionsByCourse,
  lessons,
  sectionLocalesByKey,
  lessonLocalesByKey,
  requestedLocales,
}) {
  const chunks = [];
  const courseById = rowMap(courses, (row) => String(row.id));
  const sectionById = new Map();
  for (const group of sectionsByCourse.values()) {
    for (const section of group) {
      sectionById.set(String(section.id), section);
    }
  }

  for (const lesson of lessons) {
    const courseId = String(lesson.course_id);
    const lessonId = String(lesson.id);
    const courseRow = courseById.get(courseId);
    if (!courseRow) continue;
    const courseData = courseRow.data ?? {};
    const lessonData = lesson.data ?? {};
    const sectionRow = sectionById.get(String(lesson.section_id));
    const sectionData = sectionRow?.data ?? {};
    const locales = localeConfigSupported(courseData.i18n).filter((locale) => requestedLocales.includes(locale));
    for (const locale of locales) {
      const localizedCourse = courseLocalesByKey.get(`${courseId}:${locale}`)?.data ?? null;
      const localizedSection = sectionLocalesByKey.get(`${courseId}:${lesson.section_id}:${locale}`)?.data ?? null;
      const localizedLesson = lessonLocalesByKey.get(`${courseId}:${lessonId}:${locale}`)?.data ?? null;
      const courseTitle = trimText(buildLocaleFallback(courseData, localizedCourse, ["title"]).title) || `Course ${courseId}`;
      const sectionMerged = buildLocaleFallback(sectionData, localizedSection, ["title", "description"]);
      const lessonMerged = buildLocaleFallback(lessonData, localizedLesson, [
        "title",
        "short_description",
        "description_markdown",
        "resources",
      ]);
      const lessonTitle = trimText(lessonMerged.title) || `Lesson ${lessonId}`;
      const sectionTitle = trimText(sectionMerged.title) || "Section";
      const summary = contentFromParts([
        `Course: ${courseTitle}`,
        `Section: ${sectionTitle}`,
        `Lesson: ${lessonTitle}`,
        trimText(lessonMerged.short_description) ? `Summary: ${trimText(lessonMerged.short_description)}` : "",
        trimText(sectionMerged.description) ? `Section notes: ${trimText(sectionMerged.description)}` : "",
      ]);
      const href = lessonHref(courseId, lessonId);
      const lessonTopic =
        trimText(lessonData.topic) ||
        trimText(lessonData.subtopic) ||
        lessonTitle;

      chunks.push(
        buildChunk({
          contentCategory: "lesson",
          locale,
          title: lessonTitle,
          topic: lessonTopic,
          subtopic: sectionTitle,
          content: summary,
          track: courseTitle,
          sourceTable: "course_lessons",
          sourceId: lessonId,
          sourceUpdatedAt: courseRow.updated_at,
          chunkKind: "summary",
          chunkIndex: 0,
          metadata: {
            href,
            lessonId,
            courseId,
            sectionId: String(lesson.section_id),
            courseSlug: trimText(courseRow.slug) || null,
            courseTitle,
            sectionTitle,
          },
        }),
      );

      splitIntoWindows(stripMarkdown(lessonMerged.description_markdown)).forEach((windowText, index) => {
        chunks.push(
          buildChunk({
            contentCategory: "lesson",
            locale,
            title: lessonTitle,
            topic: lessonTopic,
            subtopic: sectionTitle,
            content: contentFromParts([
              `Course: ${courseTitle}`,
              `Lesson: ${lessonTitle}`,
              `Lesson body ${index + 1}`,
              windowText,
            ]),
            track: courseTitle,
            sourceTable: "course_lessons",
            sourceId: lessonId,
            sourceUpdatedAt: courseRow.updated_at,
            chunkKind: "body",
            chunkIndex: index,
            metadata: {
              href,
              lessonId,
              courseId,
              sectionId: String(lesson.section_id),
              courseSlug: trimText(courseRow.slug) || null,
              courseTitle,
              sectionTitle,
            },
          }),
        );
      });

      const resources = Array.isArray(lessonMerged.resources)
        ? lessonMerged.resources
            .map((resource) => ({
              title: trimText(resource?.title),
              url: trimText(resource?.url),
            }))
            .filter((resource) => resource.title || resource.url)
        : [];
      if (resources.length > 0) {
        chunks.push(
          buildChunk({
            contentCategory: "lesson",
            locale,
            title: lessonTitle,
            topic: lessonTopic,
            subtopic: "resources",
            content: contentFromParts([
              `Course: ${courseTitle}`,
              `Lesson: ${lessonTitle}`,
              "Resources:",
              ...resources.map((resource) =>
                [resource.title ? `- ${resource.title}` : "-", resource.url ? `(${resource.url})` : ""]
                  .filter(Boolean)
                  .join(" "),
              ),
            ]),
            track: courseTitle,
            sourceTable: "course_lessons",
            sourceId: lessonId,
            sourceUpdatedAt: courseRow.updated_at,
            chunkKind: "resources",
            chunkIndex: 0,
            metadata: {
              href,
              lessonId,
              courseId,
              sectionId: String(lesson.section_id),
              courseSlug: trimText(courseRow.slug) || null,
              courseTitle,
              sectionTitle,
            },
          }),
        );
      }
    }
  }
  return chunks;
}

function buildCareerTrackChunks({
  tracks,
  localesByTrackLocale,
  coursesById,
  trackCoursesByTrackId,
  instructorHandlesById,
  requestedLocales,
}) {
  const chunks = [];
  for (const track of tracks) {
    const trackId = String(track.id);
    const supportedLocales = localeConfigSupported(track.i18n).filter((locale) => requestedLocales.includes(locale));
    for (const locale of supportedLocales) {
      const localized = localesByTrackLocale.get(`${trackId}:${locale}`)?.data ?? null;
      const merged = buildLocaleFallback(track, localized, [
        "title",
        "description",
        "what_youll_learn",
        "prerequisites",
      ]);
      const title = trimText(merged.title) || `Career track ${trackId}`;
      const slug = trimText(track.slug) || trackId;
      const href =
        track.owner_scope === "corelia"
          ? `/career/corelia/${encodeURIComponent(slug)}`
          : track.instructor_id && instructorHandlesById.get(track.instructor_id)
            ? `/career/${encodeURIComponent(instructorHandlesById.get(track.instructor_id))}/${encodeURIComponent(slug)}`
            : "/career";
      const includedCourses = (trackCoursesByTrackId.get(trackId) ?? [])
        .map((row) => coursesById.get(String(row.course_id)))
        .filter(Boolean);

      chunks.push(
        buildChunk({
          contentCategory: "career_track",
          locale,
          title,
          topic: title,
          subtopic: slug,
          content: contentFromParts([
            `Career track: ${title}`,
            trimText(merged.description) ? `Description: ${trimText(merged.description)}` : "",
          ]),
          track: slug,
          sourceTable: "career_tracks",
          sourceId: trackId,
          sourceUpdatedAt: track.updated_at,
          chunkKind: "overview",
          chunkIndex: 0,
          metadata: {
            href,
            slug,
            ownerScope: track.owner_scope ?? null,
            instructorHandle: track.instructor_id ? instructorHandlesById.get(track.instructor_id) ?? null : null,
            careerTrackId: trackId,
          },
        }),
      );

      chunks.push(
        buildChunk({
          contentCategory: "career_track",
          locale,
          title,
          topic: title,
          subtopic: "curriculum",
          content: contentFromParts([
            `Career track: ${title}`,
            toSentenceList(merged.what_youll_learn).length
              ? `What you'll learn: ${toSentenceList(merged.what_youll_learn).join("; ")}`
              : "",
            toSentenceList(merged.prerequisites).length
              ? `Prerequisites: ${toSentenceList(merged.prerequisites).join("; ")}`
              : "",
          ]),
          track: slug,
          sourceTable: "career_tracks",
          sourceId: trackId,
          sourceUpdatedAt: track.updated_at,
          chunkKind: "curriculum",
          chunkIndex: 0,
          metadata: {
            href,
            slug,
            ownerScope: track.owner_scope ?? null,
            instructorHandle: track.instructor_id ? instructorHandlesById.get(track.instructor_id) ?? null : null,
            careerTrackId: trackId,
          },
        }),
      );

      if (includedCourses.length > 0) {
        chunks.push(
          buildChunk({
            contentCategory: "career_track",
            locale,
            title,
            topic: title,
            subtopic: "included courses",
            content: contentFromParts([
              `Career track: ${title}`,
              "Included courses:",
              ...includedCourses.map((course) => {
                const courseData = course.data ?? {};
                return [
                  `- ${trimText(courseData.title) || String(course.id)}`,
                  trimText(courseData.short_description) ? `: ${trimText(courseData.short_description)}` : "",
                ].join("");
              }),
            ]),
            track: slug,
            sourceTable: "career_tracks",
            sourceId: trackId,
            sourceUpdatedAt: track.updated_at,
            chunkKind: "mapping",
            chunkIndex: 0,
            metadata: {
              href,
              slug,
              ownerScope: track.owner_scope ?? null,
              instructorHandle: track.instructor_id ? instructorHandlesById.get(track.instructor_id) ?? null : null,
              careerTrackId: trackId,
              courseIds: includedCourses.map((course) => String(course.id)),
            },
          }),
        );
      }
    }
  }
  return chunks;
}

function applyHackathonLocale(baseDocument, localized) {
  return {
    title: localized?.title ?? baseDocument.title ?? "",
    tagline: localized?.tagline ?? baseDocument.tagline ?? "",
    description: localized?.description ?? baseDocument.description ?? "",
    rules: localized?.rules ?? baseDocument.rules ?? "",
    prize_pool_summary: localized?.prize_pool_summary ?? baseDocument.prize_pool_summary ?? "",
    timeline_milestones: localized?.timeline_milestones ?? baseDocument.timeline_milestones ?? [],
    faqs: localized?.faqs ?? baseDocument.faqs ?? [],
    resources: localized?.resources ?? baseDocument.resources ?? [],
  };
}

function buildActivityChunks({
  hackathons,
  hackathonLocalesByKey,
  projects,
  projectLocalesByKey,
  requestedLocales,
}) {
  const chunks = [];

  for (const row of hackathons) {
    const hackathonId = String(row.id);
    const baseDocument = row.document ?? {};
    const supportedLocales = localeConfigSupported(baseDocument.i18n).filter((locale) => requestedLocales.includes(locale));
    for (const locale of supportedLocales) {
      const localized = hackathonLocalesByKey.get(`${hackathonId}:${locale}`)?.data ?? null;
      const merged = applyHackathonLocale(baseDocument, localized);
      const title = trimText(merged.title) || `Hackathon ${hackathonId}`;
      const slug = trimText(row.slug) || hackathonId;
      const href = `/hackathons/${encodeURIComponent(slug)}`;

      chunks.push(
        buildChunk({
          contentCategory: "activity",
          locale,
          title,
          topic: title,
          subtopic: "overview",
          content: contentFromParts([
            `Hackathon: ${title}`,
            trimText(merged.tagline) ? `Tagline: ${trimText(merged.tagline)}` : "",
            trimText(merged.description) ? `Description: ${trimText(merged.description)}` : "",
            `Status: ${trimText(row.status) || "unknown"}`,
          ]),
          track: slug,
          sourceTable: "hackathons",
          sourceId: hackathonId,
          sourceUpdatedAt: row.updated_at,
          chunkKind: "overview",
          chunkIndex: 0,
          metadata: { href, slug, hackathonId, status: trimText(row.status) || null },
        }),
      );

      const rulesAndTimeline = contentFromParts([
        trimText(merged.rules) ? `Rules: ${trimText(merged.rules)}` : "",
        Array.isArray(merged.timeline_milestones) && merged.timeline_milestones.length > 0
          ? `Timeline: ${merged.timeline_milestones
              .map((item) => [trimText(item?.title), trimText(item?.description)].filter(Boolean).join(" - "))
              .filter(Boolean)
              .join("; ")}`
          : "",
      ]);
      if (rulesAndTimeline) {
        chunks.push(
          buildChunk({
            contentCategory: "activity",
            locale,
            title,
            topic: title,
            subtopic: "rules and timeline",
            content: contentFromParts([`Hackathon: ${title}`, rulesAndTimeline]),
            track: slug,
            sourceTable: "hackathons",
            sourceId: hackathonId,
            sourceUpdatedAt: row.updated_at,
            chunkKind: "rules_timeline",
            chunkIndex: 0,
            metadata: { href, slug, hackathonId, status: trimText(row.status) || null },
          }),
        );
      }

      const faqText = Array.isArray(merged.faqs)
        ? merged.faqs
            .map((faq) => {
              const question = trimText(faq?.question);
              const answer = trimText(faq?.answer);
              if (!question && !answer) return "";
              return `Q: ${question}\nA: ${answer}`;
            })
            .filter(Boolean)
            .join("\n\n")
        : "";
      if (faqText) {
        chunks.push(
          buildChunk({
            contentCategory: "activity",
            locale,
            title,
            topic: title,
            subtopic: "faq",
            content: contentFromParts([`Hackathon: ${title}`, faqText]),
            track: slug,
            sourceTable: "hackathons",
            sourceId: hackathonId,
            sourceUpdatedAt: row.updated_at,
            chunkKind: "faq",
            chunkIndex: 0,
            metadata: { href, slug, hackathonId, status: trimText(row.status) || null },
          }),
        );
      }

      const prizesAndResources = contentFromParts([
        trimText(merged.prize_pool_summary) ? `Prizes: ${trimText(merged.prize_pool_summary)}` : "",
        Array.isArray(merged.resources) && merged.resources.length > 0
          ? `Resources: ${merged.resources
              .map((item) => [trimText(item?.title), trimText(item?.url)].filter(Boolean).join(" "))
              .filter(Boolean)
              .join("; ")}`
          : "",
      ]);
      if (prizesAndResources) {
        chunks.push(
          buildChunk({
            contentCategory: "activity",
            locale,
            title,
            topic: title,
            subtopic: "prizes and resources",
            content: contentFromParts([`Hackathon: ${title}`, prizesAndResources]),
            track: slug,
            sourceTable: "hackathons",
            sourceId: hackathonId,
            sourceUpdatedAt: row.updated_at,
            chunkKind: "prize_resources",
            chunkIndex: 0,
            metadata: { href, slug, hackathonId, status: trimText(row.status) || null },
          }),
        );
      }
    }
  }

  for (const row of projects) {
    const projectId = String(row.id);
    const supportedLocales = localeConfigSupported(row.i18n).filter((locale) => requestedLocales.includes(locale));
    for (const locale of supportedLocales) {
      const localized = projectLocalesByKey.get(`${projectId}:${locale}`)?.data ?? null;
      const title = trimText(localized?.title ?? row.title) || `Project ${projectId}`;
      const summary = trimText(localized?.summary ?? row.summary);
      const links = [
        row.demo_url ? "demo" : "",
        row.repo_url ? "repo" : "",
        row.slide_url ? "slides" : "",
        row.video_url ? "video" : "",
      ].filter(Boolean);
      chunks.push(
        buildChunk({
          contentCategory: "activity",
          locale,
          title,
          topic: title,
          subtopic: "project",
          content: contentFromParts([
            `Project: ${title}`,
            summary ? `Summary: ${summary}` : "",
            trimText(row.source_type) ? `Source type: ${trimText(row.source_type)}` : "",
            links.length ? `Available links: ${links.join(", ")}` : "",
          ]),
          track: null,
          sourceTable: "projects",
          sourceId: projectId,
          sourceUpdatedAt: row.updated_at,
          chunkKind: "summary",
          chunkIndex: 0,
          metadata: {
            href: "/projects",
            projectId,
            sourceType: trimText(row.source_type) || null,
          },
        }),
      );
    }
  }

  return chunks;
}

function buildPlatformGuideChunks(requestedLocales) {
  return PLATFORM_GUIDE_ENTRIES
    .filter((entry) => requestedLocales.includes(entry.locale))
    .map((entry, index) =>
      buildChunk({
        contentCategory: "platform_guide",
        locale: entry.locale,
        title: entry.title,
        topic: entry.title,
        subtopic: entry.kind,
        content: entry.content,
        track: null,
        sourceTable: "platform_guides",
        sourceId: `${entry.locale}:${entry.kind}:${index}`,
        sourceUpdatedAt: new Date("2026-05-20T00:00:00.000Z").toISOString(),
        chunkKind: entry.kind,
        chunkIndex: index,
        metadata: {
          href: "/account/cora",
          guideKind: entry.kind,
        },
      }),
    );
}

function describeCredentialRule(row, locale) {
  const triggerRule = row.trigger_rule ?? null;
  if (row.scope_type === "course") {
    const completionPct = Number(triggerRule?.completion_pct ?? 100);
    const requireAssignmentPass = Boolean(triggerRule?.require_assignment_pass);
    const minAssignmentScore = Number(triggerRule?.min_assignment_score ?? 0);
    if (locale === "vi") {
      return [
        `Hoàn thành tối thiểu ${completionPct}% khóa học.`,
        requireAssignmentPass
          ? `Cần đạt bài tập cuối khóa với điểm tối thiểu ${minAssignmentScore}.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");
    }
    return [
      `Complete at least ${completionPct}% of the course.`,
      requireAssignmentPass
        ? `Pass the final assignment with a minimum score of ${minAssignmentScore}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (row.scope_type === "hackathon") {
    return locale === "vi"
      ? `Được cấp theo vai trò ${trimText(row.hackathon_role) || "participant"} trong hackathon.`
      : `Awarded for the ${trimText(row.hackathon_role) || "participant"} role in the hackathon.`;
  }
  if (row.scope_type === "activity_milestone") {
    if (locale === "vi") {
      return trimText(JSON.stringify(triggerRule)) || "Mốc hoạt động do Corelia xác định.";
    }
    return trimText(JSON.stringify(triggerRule)) || "Activity milestone defined by Corelia.";
  }
  return "";
}

function buildCredentialChunks(templates, courseById, hackathonById, requestedLocales) {
  const chunks = [];
  for (const row of templates) {
    const templateId = String(row.id);
    for (const locale of requestedLocales) {
      const relatedCourse = row.course_id ? courseById.get(String(row.course_id)) : null;
      const relatedHackathon = row.hackathon_id ? hackathonById.get(String(row.hackathon_id)) : null;
      const title = trimText(row.name) || `Credential ${templateId}`;
      const description = trimText(row.description);
      const eligibility = describeCredentialRule(row, locale);
      const relatedLabel =
        row.scope_type === "course"
          ? trimText(relatedCourse?.data?.title)
          : row.scope_type === "hackathon"
            ? trimText(relatedHackathon?.document?.title)
            : "";
      chunks.push(
        buildChunk({
          contentCategory: "credential",
          locale,
          title,
          topic: title,
          subtopic: trimText(row.scope_type),
          content: contentFromParts([
            locale === "vi" ? `Chứng nhận: ${title}` : `Credential: ${title}`,
            description ? `${locale === "vi" ? "Mô tả" : "Description"}: ${description}` : "",
            relatedLabel ? `${locale === "vi" ? "Liên quan" : "Related to"}: ${relatedLabel}` : "",
            eligibility ? `${locale === "vi" ? "Điều kiện" : "Eligibility"}: ${eligibility}` : "",
          ]),
          track: trimText(row.scope_type),
          sourceTable: "credential_templates",
          sourceId: templateId,
          sourceUpdatedAt: row.updated_at,
          chunkKind: "eligibility",
          chunkIndex: 0,
          metadata: {
            href: "/achievements",
            scopeType: trimText(row.scope_type),
            courseId: row.course_id ? String(row.course_id) : null,
            hackathonId: row.hackathon_id ? String(row.hackathon_id) : null,
            hackathonRole: trimText(row.hackathon_role) || null,
          },
        }),
      );
    }
  }
  return chunks;
}

function buildDesiredChunks({
  categories,
  requestedLocales,
  courses,
  courseLocales,
  sections,
  sectionLocales,
  lessons,
  lessonLocales,
  tracks,
  trackLocales,
  trackCourses,
  instructorHandles,
  hackathons,
  hackathonLocales,
  projects,
  projectLocales,
  credentialTemplates,
}) {
  const chunks = [];
  const courseLocalesByKey = rowMap(courseLocales, (row) => `${row.course_id}:${row.locale}`);
  const sectionsByCourse = rowGroup(sections, (row) => String(row.course_id));
  const sectionLocalesByKey = rowMap(
    sectionLocales,
    (row) => `${row.course_id}:${row.section_id}:${row.locale}`,
  );
  const lessonLocalesByKey = rowMap(
    lessonLocales,
    (row) => `${row.course_id}:${row.lesson_id}:${row.locale}`,
  );
  const trackLocalesByKey = rowMap(trackLocales, (row) => `${row.career_track_id}:${row.locale}`);
  const trackCoursesByTrackId = rowGroup(trackCourses, (row) => String(row.career_track_id));
  const coursesById = rowMap(courses, (row) => String(row.id));
  const hackathonLocalesByKey = rowMap(hackathonLocales, (row) => `${row.hackathon_id}:${row.locale}`);
  const projectLocalesByKey = rowMap(projectLocales, (row) => `${row.project_id}:${row.locale}`);
  const hackathonById = rowMap(hackathons, (row) => String(row.id));
  const instructorHandlesById = new Map(
    instructorHandles.map((row) => [String(row.id), trimText(row.username) || trimText(row.ocid) || null]),
  );

  if (categories.includes("course_catalog")) {
    chunks.push(...buildCourseChunks(courses, courseLocalesByKey, requestedLocales));
  }
  if (categories.includes("lesson")) {
    chunks.push(
      ...buildLessonChunks({
        courses,
        courseLocalesByKey,
        sectionsByCourse,
        lessons,
        sectionLocalesByKey,
        lessonLocalesByKey,
        requestedLocales,
      }),
    );
  }
  if (categories.includes("career_track")) {
    chunks.push(
      ...buildCareerTrackChunks({
        tracks,
        localesByTrackLocale: trackLocalesByKey,
        coursesById,
        trackCoursesByTrackId,
        instructorHandlesById,
        requestedLocales,
      }),
    );
  }
  if (categories.includes("activity")) {
    chunks.push(
      ...buildActivityChunks({
        hackathons,
        hackathonLocalesByKey,
        projects,
        projectLocalesByKey,
        requestedLocales,
      }),
    );
  }
  if (categories.includes("platform_guide")) {
    chunks.push(...buildPlatformGuideChunks(requestedLocales));
  }
  if (categories.includes("credential")) {
    chunks.push(...buildCredentialChunks(credentialTemplates, coursesById, hackathonById, requestedLocales));
  }

  return chunks.filter((chunk) => chunk.content && chunk.title);
}

function chunkUniqueKey(chunk) {
  return [
    chunk.source_table,
    chunk.source_id,
    chunk.locale,
    chunk.chunk_kind,
    chunk.chunk_index,
  ].join("|");
}

async function fetchExistingChunks(db, categories, locales) {
  let query = db
    .from("knowledge_chunks")
    .select(
      "id,content_category,locale,source_table,source_id,chunk_kind,chunk_index,checksum,embedding,embedding_model,embedded_at",
    )
    .eq("source", SOURCE)
    .in("content_category", categories)
    .in("locale", locales);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function embedTexts(texts) {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey || texts.length === 0) {
    return texts.map(() => null);
  }
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Embedding request failed: ${response.status} ${text}`);
  }
  const payload = await response.json();
  const embeddings = Array.isArray(payload?.data) ? payload.data : [];
  return texts.map((_, index) => embeddings[index]?.embedding ?? null);
}

async function attachEmbeddings(chunks) {
  if (chunks.length === 0) return chunks;
  const batchSize = 20;
  const output = [];
  for (let index = 0; index < chunks.length; index += batchSize) {
    const slice = chunks.slice(index, index + batchSize);
    const embeddings = await embedTexts(slice.map((chunk) => chunk.content));
    for (let cursor = 0; cursor < slice.length; cursor += 1) {
      const chunk = { ...slice[cursor] };
      const embedding = embeddings[cursor];
      if (Array.isArray(embedding) && embedding.length > 0) {
        chunk.embedding = vectorLiteral(embedding);
        chunk.embedding_model = EMBEDDING_MODEL;
        chunk.embedded_at = new Date().toISOString();
      }
      output.push(chunk);
    }
  }
  return output;
}

function summarizeChanges(desiredChunks, existingRows) {
  const existingByKey = new Map(existingRows.map((row) => [chunkUniqueKey(row), row]));
  const desiredByKey = new Map(desiredChunks.map((row) => [chunkUniqueKey(row), row]));
  const created = [];
  const updated = [];
  const unchanged = [];
  const deleted = [];

  for (const chunk of desiredChunks) {
    const existing = existingByKey.get(chunkUniqueKey(chunk));
    if (!existing) {
      created.push(chunk);
      continue;
    }
    if (existing.checksum === chunk.checksum) {
      unchanged.push(chunk);
      continue;
    }
    updated.push({ ...chunk, id: existing.id });
  }

  for (const row of existingRows) {
    if (!desiredByKey.has(chunkUniqueKey(row))) {
      deleted.push(row);
    }
  }

  return { created, updated, unchanged, deleted };
}

function summarizeByCategoryAndLocale(items, kind = "content_category") {
  return items.reduce((acc, item) => {
    const category = String(item[kind] ?? "unknown");
    const locale = String(item.locale ?? "n/a");
    const key = `${category}:${locale}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

async function deleteChunksByIds(db, ids) {
  const batchSize = 200;
  for (let index = 0; index < ids.length; index += batchSize) {
    const slice = ids.slice(index, index + batchSize);
    const { error } = await db.from("knowledge_chunks").delete().in("id", slice);
    if (error) throw new Error(error.message);
  }
}

async function upsertChunks(db, chunks) {
  const batchSize = 100;
  for (let index = 0; index < chunks.length; index += batchSize) {
    const slice = chunks.slice(index, index + batchSize);
    const { error } = await db.from("knowledge_chunks").upsert(slice, {
      onConflict: "source_table,source_id,locale,chunk_kind,chunk_index",
    });
    if (error) throw new Error(error.message);
  }
}

async function main() {
  const shouldWrite = process.argv.includes("--write");
  const categories = parseCategoryArg();
  const requestedLocales = parseLocaleArg();
  const db = createServiceClient();

  const [courses, tracks, hackathons, projects, credentialTemplates] = await Promise.all([
    fetchPublishedCourses(db),
    fetchCareerTracks(db),
    fetchPublicHackathons(db),
    fetchPublicProjects(db),
    fetchActiveCredentialTemplates(db),
  ]);

  const courseIds = courses.map((course) => course.id);
  const trackIds = tracks.map((track) => track.id);
  const hackathonIds = hackathons.map((hackathon) => hackathon.id);
  const projectIds = projects.map((project) => project.id);
  const instructorIds = Array.from(
    new Set(tracks.map((track) => track.instructor_id).filter(Boolean)),
  );

  const [
    courseLocales,
    sections,
    sectionLocales,
    lessons,
    lessonLocales,
    trackLocales,
    trackCourses,
    instructorHandles,
    hackathonLocales,
    projectLocales,
  ] = await Promise.all([
    fetchCourseLocales(db, courseIds),
    fetchCourseSections(db, courseIds),
    fetchCourseSectionLocales(db, courseIds),
    fetchLessonsForCourses(db, courseIds),
    fetchLessonLocales(db, courseIds),
    fetchCareerTrackLocales(db, trackIds),
    fetchCareerTrackCourses(db, trackIds),
    fetchPublicProfiles(db, instructorIds),
    fetchHackathonLocales(db, hackathonIds),
    fetchProjectLocales(db, projectIds),
  ]);

  const desiredChunks = buildDesiredChunks({
    categories,
    requestedLocales,
    courses,
    courseLocales,
    sections,
    sectionLocales,
    lessons,
    lessonLocales,
    tracks,
    trackLocales,
    trackCourses,
    instructorHandles,
    hackathons,
    hackathonLocales,
    projects,
    projectLocales,
    credentialTemplates,
  });

  const existingChunks = await fetchExistingChunks(db, categories, requestedLocales);
  const diff = summarizeChanges(desiredChunks, existingChunks);
  const createdAndUpdated = await attachEmbeddings([
    ...diff.created,
    ...diff.updated,
  ]);
  const writes = {
    created: createdAndUpdated.slice(0, diff.created.length),
    updated: createdAndUpdated.slice(diff.created.length),
  };

  const summary = {
    mode: shouldWrite ? "write" : "dry-run",
    source: SOURCE,
    categories,
    locales: requestedLocales,
    totalDesiredChunks: desiredChunks.length,
    created: diff.created.length,
    updated: diff.updated.length,
    unchanged: diff.unchanged.length,
    deleted: diff.deleted.length,
    createdByCategoryLocale: summarizeByCategoryAndLocale(diff.created),
    updatedByCategoryLocale: summarizeByCategoryAndLocale(diff.updated),
    unchangedByCategoryLocale: summarizeByCategoryAndLocale(diff.unchanged),
    deletedByCategoryLocale: summarizeByCategoryAndLocale(diff.deleted),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!shouldWrite) {
    console.log("\nDry run only. Re-run with --write to persist knowledge chunk changes.");
    return;
  }

  if (diff.deleted.length > 0) {
    await deleteChunksByIds(db, diff.deleted.map((row) => row.id));
  }
  if (writes.created.length > 0 || writes.updated.length > 0) {
    await upsertChunks(db, [...writes.created, ...writes.updated]);
  }

  console.log("\nReindexed knowledge_chunks successfully.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
