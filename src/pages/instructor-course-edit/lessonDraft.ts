import type { CourseLessonLocaleContent, SupportedCourseLocale } from "@/types/courses";
import { parseTimestampLabelToSeconds } from "@/lib/youtubeChapters";
import { changedLocaleFields } from "@/features/learning/translationDraft";

export type LessonDraft = {
  title: string; youtubeUrl: string; videoPrimaryLocale: SupportedCourseLocale;
  hasSubtitle: boolean; subtitleLocales: SupportedCourseLocale[];
  shortDescription: string; markdown: string;
  resources: Array<{ title: string; url: string }>;
  practiceSourceLessonId: string; practiceSourceLessonIds: string[];
  startLabel: string; endLabel: string; useSourceVideo: boolean;
};

export function lessonDraftPatch(draft: LessonDraft, saved: LessonDraft | undefined, primary: boolean): Partial<CourseLessonLocaleContent> {
  const payload = (value: LessonDraft): Partial<CourseLessonLocaleContent> => ({
    title: value.title, short_description: value.shortDescription,
    description_markdown: value.markdown, resources: value.resources,
    youtube_url: !primary && value.useSourceVideo ? "" : value.youtubeUrl.trim(),
    youtube_start_seconds: !primary && value.useSourceVideo ? 0 : parseTimestampLabelToSeconds(value.startLabel.trim()) ?? 0,
    youtube_end_seconds: !primary && value.useSourceVideo ? null : value.endLabel.trim() ? parseTimestampLabelToSeconds(value.endLabel.trim()) : null,
    video_primary_locale: value.videoPrimaryLocale, has_subtitle: value.hasSubtitle, subtitle_locales: value.subtitleLocales,
  });
  const current = payload(draft);
  const patch = changedLocaleFields(current, saved ? payload(saved) : {});
  if (!primary && ("youtube_url" in patch || "youtube_start_seconds" in patch || "youtube_end_seconds" in patch)) {
    // A video override owns its entire segment, independent of the source video.
    Object.assign(patch, { youtube_url: current.youtube_url, youtube_start_seconds: current.youtube_start_seconds, youtube_end_seconds: current.youtube_end_seconds });
  }
  return patch;
}
