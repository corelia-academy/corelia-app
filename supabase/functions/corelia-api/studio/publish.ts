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
import { lessonRefs } from "./lessons.ts";

/** The database or the data refused this course: a reason for the run, not a fault to retry. */
export class PublishRejected extends Error {}

/** Content locales the app supports for courses (CourseI18nConfig.supported_locales). */
const COURSE_LOCALES = ["vi", "en"];

interface CurriculumFull {
  outcomes: { id: string; text: string }[];
  modules: { id: string; title: string; description: string; lessons: { id: string }[] }[];
}
interface BriefFull {
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
}

export interface PublishPayload {
  course: { slug: string; data: Record<string, unknown> };
  sections: { id: string; sort_order: number; data: Record<string, unknown> }[];
  lessons: { id: string; section_id: string; sort_order: number; data: Record<string, unknown> }[];
  questions: { lesson_id: string; sort_order: number; data: Record<string, unknown> }[];
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
  if (!COURSE_LOCALES.includes(brief.locale)) throw new PublishRejected(`Ngôn ngữ nội dung ${brief.locale} chưa được app hỗ trợ cho khóa học (${COURSE_LOCALES.join(", ")}).`);
  const refs = lessonRefs(curriculum);

  const lessons = refs.map((ref, index) => {
    const record = input.records[ref.lesson.id];
    if (!record) throw new PublishRejected(`Thiếu lesson ${ref.lesson.id}.`);
    // id, section, position and published are columns; everything else is the lesson's data.
    const { id: _id, section_id: _section, order: _order, ...data } = record.draft.lesson;
    if (data.description_markdown) data.description_markdown = publishMarkdown(data.description_markdown, input.courseId, ref.lesson.id);
    return { id: ref.lesson.id, section_id: ref.moduleId, sort_order: index, data: data as Record<string, unknown> };
  });
  const questions = refs.flatMap((ref) =>
    input.records[ref.lesson.id].draft.questions.map((q, i) => ({ lesson_id: ref.lesson.id, sort_order: i, data: q as unknown as Record<string, unknown> }))
  );

  return {
    course: {
      slug: slugify(input.title),
      data: {
        title: input.title,
        description: `${brief.topic}. ${brief.audience}`,
        short_description: brief.topic,
        level: brief.level,
        learning_outcomes: curriculum.outcomes.map((o) => o.text),
        thumbnail_url: "",
        i18n: { supported_locales: [brief.locale], primary_content_locale: brief.locale },
        owner_type: "corelia",
        course_type: "ai_generated",
        has_sections: true,
      },
    },
    sections: curriculum.modules.map((m, i) => ({ id: m.id, sort_order: i, data: { title: m.title, description: m.description } })),
    lessons,
    questions,
  };
}

/** Images of the run: draft object and its place in the app. */
export function imageJobs(input: Pick<PublishInput, "runId" | "courseId" | "records">): { from: string; to: string }[] {
  return Object.entries(input.records).flatMap(([lessonId, r]) =>
    r.draft.diagrams.map((d) => ({ from: draftPath(input.runId, lessonId, d.id), to: appImagePath(input.courseId, diagramFile(lessonId, d.id)) }))
  );
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
