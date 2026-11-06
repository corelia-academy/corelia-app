// Step `publish`: writes an accepted run as a published app course. The records written are the
// app's own (courses, course_sections, course_lessons, course_section_questions); the app's
// database guards decide whether the course may be published, and run in the same transaction as
// the write (studio_publish_course), so a refusal leaves nothing behind but copied images, which
// are removed.

import type { SupabaseClient } from "../lib/supabase.ts";
import type { LessonRecord } from "./checks.ts";
import {
  appCoverPath,
  appCoverUrl,
  COVER_BUCKET,
  renderCoverPng,
  resolveCoverPlan,
} from "./cover.tsx";
import { appImagePath, diagramFile, draftPath, publishMarkdown } from "./diagram_render.ts";
import {
  TRANSLATION_LOCALES,
  type TranslationLocale,
  type TranslatedCourse,
  type TranslatedSection,
  type TranslatedLesson,
  buildLessonLocaleData,
  validateLessonTranslation,
  validateCourseTranslation,
  validateSectionTranslation,
  stableQuestionId,
  canonicalCourseDescription,
  canonicalCourseShortDescription,
} from "./translate.ts";
import { lessonRefs } from "./lessons.ts";

/** The database or the data refused this course: a reason for the run, not a fault to retry. */
export class PublishRejected extends Error {}

/** Content locales the app supports for courses (CourseI18nConfig.supported_locales). */
export const COURSE_LOCALES = ["en", "zh-CN", "ko", "es", "zh-TW", "vi", "ja"] as const;
export type CourseContentLocale = typeof COURSE_LOCALES[number];

interface CurriculumFull {
  outcomes: { id: string; text: string }[];
  modules: { id: string; title: string; description: string; lessons: { id: string }[] }[];
}
interface BriefFull {
  title?: string;
  topic: string;
  audience: string;
  level: string;
  locale: string;
}

export interface PublishInput {
  runId: string;
  /** The Studio course id; it is also the app course id. */
  courseId: string;
  title: string;
  brief: unknown;
  curriculum: unknown;
  records: Record<string, LessonRecord>;
  translations?: Record<string, any>;
}

export interface PublishPayload {
  course: { slug: string; data: Record<string, unknown> };
  sections: { id: string; sort_order: number; data: Record<string, unknown> }[];
  lessons: { id: string; section_id: string; sort_order: number; data: Record<string, unknown> }[];
  questions: { id: string; lesson_id: string; sort_order: number; data: Record<string, unknown> }[];
  course_locales: { locale: string; data: Record<string, unknown> }[];
  section_locales: { section_id: string; locale: string; data: Record<string, unknown> }[];
  lesson_locales: { lesson_id: string; locale: string; data: Record<string, unknown> }[];
}

export function slugify(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "course";
}

/** Rows of the app tables for one run. Pure. */
export function buildPublishPayload(input: PublishInput): PublishPayload {
  const curriculum = input.curriculum as CurriculumFull;
  const brief = input.brief as BriefFull;
  if (!COURSE_LOCALES.includes(brief.locale as any)) throw new PublishRejected(`Ngôn ngữ nội dung ${brief.locale} chưa được app hỗ trợ cho khóa học (${COURSE_LOCALES.join(", ")}).`);
  const refs = lessonRefs(curriculum);

  const lessons = refs.map((ref, index) => {
    const record = input.records[ref.lesson.id];
    if (!record) throw new PublishRejected(`Thiếu lesson ${ref.lesson.id}.`);
    // id, section, position and published are columns; everything else is the lesson's data.
    const { id: _id, section_id: _section, order: _order, ...data } = record.draft.lesson;
    if (data.description_markdown) data.description_markdown = publishMarkdown(data.description_markdown, input.courseId, ref.lesson.id);
    // Marks the lessons that close the course so the app can present them apart; absent on every other lesson.
    const rowData: Record<string, unknown> = ref.lesson.purpose === "final_check" ? { ...data, is_final_check: true } : data;
    return { id: ref.lesson.id, section_id: ref.moduleId, sort_order: index, data: rowData };
  });
  const questions = refs.flatMap((ref) =>
    input.records[ref.lesson.id].draft.questions.map((q, i) => {
      const questionId = stableQuestionId(input.courseId, ref.lesson.id, i);
      return {
        id: questionId,
        lesson_id: ref.lesson.id,
        sort_order: i,
        data: { ...(q as unknown as Record<string, unknown>), id: questionId },
      };
    })
  );

  const course_locales: PublishPayload["course_locales"] = [];
  const section_locales: PublishPayload["section_locales"] = [];
  const lesson_locales: PublishPayload["lesson_locales"] = [];

  if (!input.translations) {
    throw new PublishRejected("Thiếu dữ liệu bản dịch đa ngôn ngữ cho khóa học.");
  }

  for (const loc of TRANSLATION_LOCALES) {
    const trans = input.translations[loc];
    if (!trans) throw new PublishRejected(`Thiếu bản dịch cho ngôn ngữ ${loc}.`);
    if (!trans.course) throw new PublishRejected(`Thiếu bản dịch khóa học cho ngôn ngữ ${loc}.`);
    validateCourseTranslation({
      title: input.title,
      short_description: brief.topic,
      description: `${brief.topic}. ${brief.audience}`,
      learning_outcomes: curriculum.outcomes.map((o) => o.text),
    }, trans.course, loc);
    course_locales.push({
      locale: loc,
      data: {
        title: trans.course.title,
        short_description: trans.course.short_description,
        description: trans.course.description,
        learning_outcomes: trans.course.learning_outcomes,
      },
    });

    if (!trans.sections) throw new PublishRejected(`Thiếu bản dịch module cho ngôn ngữ ${loc}.`);
    for (const m of curriculum.modules) {
      const tSec = trans.sections[m.id];
      if (!tSec) throw new PublishRejected(`Thiếu bản dịch cho module ${m.id} ở ngôn ngữ ${loc}.`);
      validateSectionTranslation({ id: m.id, title: m.title, description: m.description }, tSec, loc);
      section_locales.push({ section_id: m.id, locale: loc, data: { title: tSec.title, description: tSec.description } });
    }

    if (!trans.lessons) throw new PublishRejected(`Thiếu bản dịch lesson cho ngôn ngữ ${loc}.`);
    for (const ref of refs) {
      const tLesson = trans.lessons[ref.lesson.id];
      const record = input.records[ref.lesson.id];
      if (!record) throw new PublishRejected(`Thiếu lesson ${ref.lesson.id}.`);
      if (!tLesson) throw new PublishRejected(`Thiếu bản dịch cho lesson ${ref.lesson.id} ở ngôn ngữ ${loc}.`);
      validateLessonTranslation(record, tLesson, loc);
      const locData = buildLessonLocaleData(record, tLesson, input.courseId, loc, publishMarkdown);
      lesson_locales.push({ lesson_id: ref.lesson.id, locale: loc, data: locData });
    }
  }

  const canonicalTitle = brief.title?.trim();
  if (!canonicalTitle) {
    throw new PublishRejected("Brief thiếu tiêu đề tiếng Anh chuẩn tắc (title).");
  }

  const supportedLocales = [...COURSE_LOCALES];

  return {
    course: {
      slug: slugify(canonicalTitle),
      data: {
        title: canonicalTitle,
        description: canonicalCourseDescription(brief),
        short_description: canonicalCourseShortDescription(brief),
        level: brief.level,
        learning_outcomes: curriculum.outcomes.map((o) => o.text),
        thumbnail_url: "",
        i18n: { supported_locales: supportedLocales, primary_content_locale: "en" },
        owner_type: "corelia",
        course_type: "ai_generated",
        has_sections: true,
      },
    },
    sections: curriculum.modules.map((m, i) => ({ id: m.id, sort_order: i, data: { title: m.title, description: m.description } })),
    lessons,
    questions,
    course_locales,
    section_locales,
    lesson_locales,
  };
}

/** Images of the run: draft object and its place in the app. */
export function imageJobs(input: Pick<PublishInput, "runId" | "courseId" | "records"> & { translations?: Record<string, any> }): { from: string; to: string }[] {
  const baseJobs = Object.entries(input.records).flatMap(([lessonId, r]) =>
    r.draft.diagrams.map((d) => ({ from: draftPath(input.runId, lessonId, d.id), to: appImagePath(input.courseId, diagramFile(lessonId, d.id)) }))
  );
  if (!input.translations) return baseJobs;

  const translatedJobs: { from: string; to: string }[] = [];
  for (const loc of TRANSLATION_LOCALES) {
    const locTranslations = input.translations[loc];
    if (!locTranslations?.lessons) continue;
    for (const [lessonId, r] of Object.entries(input.records)) {
      const tLesson = locTranslations.lessons[lessonId];
      if (!tLesson?.article?.diagrams) continue;
      for (const d of tLesson.article.diagrams) {
        translatedJobs.push({
          from: draftPath(input.runId, lessonId, d.id, loc),
          to: appImagePath(input.courseId, diagramFile(lessonId, d.id, loc)),
        });
      }
    }
  }
  return [...baseJobs, ...translatedJobs];
}

/** A SQLSTATE means the database answered and said no; anything else is a failure to reach it. */
const isDatabaseVerdict = (code: string | undefined) => /^[0-9A-Z]{5}$/.test(code ?? "");

/** Publishes the run and returns the app course id. Safe to call again after a partial failure. */
export async function publishRun(db: SupabaseClient, input: PublishInput): Promise<string> {
  const payload = buildPublishPayload(input);
  const uploaded: string[] = [];
  let coverPathUploaded: string | null = null;
  for (const job of imageJobs(input)) {
    const file = await db.storage.from("studio-drafts").download(job.from);
    if (file.error || !file.data) throw new PublishRejected(`Thiếu ảnh nháp ${job.from}.`);
    const put = await db.storage.from("app").upload(job.to, file.data, { contentType: "image/png", upsert: true });
    if (put.error) throw new Error(`Không chép được ảnh ${job.to}: ${put.error.message}`);
    uploaded.push(job.to);
  }

  // Cover generation with a hard 10s ceiling and cancellation support
  const abortController = new AbortController();
  const { signal } = abortController;
  let timerId: any;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => {
        abortController.abort(new Error("Cover generation timed out after 10s"));
        reject(new Error("Cover generation timed out after 10s"));
      }, 10_000);
    });

    const coverPromise = (async () => {
      const { data: pathRows } = await db
        .from("studio_course_paths")
        .select("learning_order, studio_paths(title)")
        .eq("course_id", input.courseId)
        .order("learning_order", { ascending: true });

      if (signal.aborted) throw signal.reason ?? new Error("Aborted");

      const paths = (pathRows ?? []).map((r: any) => ({
        title: r.studio_paths?.title ?? "",
        learning_order: r.learning_order ?? 0,
      }));

      const plan = await resolveCoverPlan(input.title, paths, (url, opts) => {
        const fetchSignal = opts?.signal
          ? AbortSignal.any([opts.signal, signal])
          : signal;
        return fetch(url, { ...opts, signal: fetchSignal });
      });

      if (signal.aborted) throw signal.reason ?? new Error("Aborted");

      const png = await renderCoverPng(plan);

      if (signal.aborted) throw signal.reason ?? new Error("Aborted");

      const coverPath = appCoverPath(input.courseId);
      const put = await db.storage.from(COVER_BUCKET).upload(coverPath, png, { contentType: "image/png", upsert: true });
      if (put.error) throw new Error(put.error.message);

      if (signal.aborted) {
        await db.storage.from(COVER_BUCKET).remove([coverPath]).catch(() => {});
        throw signal.reason ?? new Error("Aborted");
      }

      coverPathUploaded = coverPath;
      payload.course.data.thumbnail_url = appCoverUrl(db, input.courseId);
    })();

    await Promise.race([coverPromise, timeoutPromise]);
  } catch (e: any) {
    // Invariant: Lỗi ở bất kỳ bước nào của việc sinh ảnh KHÔNG được làm hỏng hoặc chặn publish.
    // thumbnail_url giữ nguyên rỗng, kèm một sự kiện cảnh báo trong studio_run_events cho bước publish.
    try {
      await db.from("studio_run_events").insert({
        run_id: input.runId,
        step_key: "publish",
        attempt: 0,
        kind: "warning",
        message: `Không sinh được ảnh cover: ${e?.message ?? e}`.slice(0, 500),
      });
    } catch {
      // ignore
    }
  } finally {
    clearTimeout(timerId);
  }

  const { data, error } = await db.rpc("studio_publish_course", {
    p_run_id: input.runId,
    p_course: payload.course,
    p_sections: payload.sections,
    p_lessons: payload.lessons,
    p_questions: payload.questions,
    p_course_locales: payload.course_locales,
    p_section_locales: payload.section_locales,
    p_lesson_locales: payload.lesson_locales,
  });
  if (error) {
    if (!isDatabaseVerdict(error.code)) throw new Error(error.message);
    // Nothing was written; the images were only a precondition of the course.
    await db.storage.from("app").remove(uploaded);
    if (coverPathUploaded) await db.storage.from(COVER_BUCKET).remove([coverPathUploaded]);
    throw new PublishRejected(`${error.message}${error.details ? ` (${error.details.slice(0, 300)})` : ""}`);
  }

  return data as string;
}
