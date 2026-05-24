import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown/Markdown";
import { isArticleLesson, isLessonDraftForLearners, isVideoLesson } from "@/lib/lessonFormat";
import { cn } from "@/lib/utils";
import { getYoutubeEmbedUrlForLesson } from "@/types/courses";
import type { CourseLesson } from "@/types/courses";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { LearnBadge } from "./LearnBadge";
import { LessonQuiz } from "./LessonQuiz";
import { LessonPractice } from "./LessonPractice";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export function LessonPlayerCard({
  lesson,
  lessonIndex,
  isDraftLesson,
  completed,
  hasFullCourseAccess,
  previousLesson,
  nextLesson,
  translate,
  onMarkComplete,
  onNavigateToLesson,
  courseId,
}: {
  lesson: CourseLesson | null;
  lessonIndex: number | null;
  isDraftLesson: boolean;
  completed: boolean;
  hasFullCourseAccess: boolean;
  previousLesson: CourseLesson | null;
  nextLesson: CourseLesson | null;
  translate: TranslateFn;
  onMarkComplete: () => void;
  onNavigateToLesson: (lessonId: string) => void;
  courseId?: string | null;
}) {
  const articleLesson = lesson ? isArticleLesson(lesson) : false;
  const videoLesson = lesson ? isVideoLesson(lesson) : false;
  const quizLesson = lesson?.lesson_format === "quiz";
  const practiceLesson = lesson?.lesson_format === "practice";
  const embedUrl =
    lesson && videoLesson && lesson.youtube_url?.trim()
      ? getYoutubeEmbedUrlForLesson(lesson)
      : null;

  const autoplayEmbedUrl = (() => {
    if (!embedUrl) return null;
    const u = new URL(embedUrl);
    u.searchParams.set("autoplay", "1");
    return u.toString();
  })();

  const showArticleBody =
    !!lesson &&
    articleLesson &&
    Boolean(lesson.description_markdown?.trim());

  const draftForDisplay = lesson ? isLessonDraftForLearners(lesson) : isDraftLesson;

  if (!lesson) {
    return (
      <div className="px-4 py-16 sm:px-6 text-center text-sm text-foreground-muted">
        {translate("detail.learn.noLessonSelected")}
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 py-4 sm:px-6">
        {lesson ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <LearnBadge variant="primaryContainer">
                {translate("detail.learn.lessonNumberBadge", {
                  index: (lessonIndex ?? 0) + 1,
                })}
              </LearnBadge>
              {articleLesson ? (
                <LearnBadge variant="outline">
                  {translate("detail.learn.articleLessonBadge")}
                </LearnBadge>
              ) : null}
              {completed ? (
                <LearnBadge variant="success">
                  {translate("detail.learn.completedBadge")}
                </LearnBadge>
              ) : null}
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-foreground">
              {lesson.title}
            </h2>
            {lesson.short_description?.trim() ? (
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-[1.7] text-foreground-muted">
                {lesson.short_description}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {lesson && autoplayEmbedUrl ? (
        <div className="mx-4 overflow-hidden rounded-2xl shadow-card sm:mx-6">
          <div className="relative aspect-video w-full bg-brand-navy">
            <iframe
              key={lesson.id}
              src={autoplayEmbedUrl}
              title={lesson.title}
              className="absolute inset-0 size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      ) : showArticleBody ? (
        <div className="mx-4 overflow-hidden rounded-2xl border border-border-subtle shadow-card sm:mx-6">
          <div className="px-6 py-8 text-[15px] leading-[1.7]">
            <Markdown content={lesson.description_markdown!} />
          </div>
        </div>
      ) : quizLesson && courseId && lesson ? (
        <LessonQuiz
          courseId={courseId}
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          onPassed={completed ? undefined : onMarkComplete}
        />
      ) : practiceLesson && lesson?.description_markdown?.trim() ? (
        <LessonPractice markdown={lesson.description_markdown} />
      ) : lesson ? (
        <div className="mx-4 mb-2 flex aspect-video items-center justify-center rounded-2xl border border-border-subtle bg-surface-raised sm:mx-6">
          {draftForDisplay ? (
            <div className="max-w-md px-6 text-center">
              <p className="text-sm font-medium text-foreground">
                {translate(
                  articleLesson
                    ? "detail.learn.lessonArticleDraftNoticeTitle"
                    : "detail.learn.lessonDraftNoticeTitle",
                )}
              </p>
              <p className="mt-2 text-sm text-foreground-muted">
                {translate(
                  articleLesson
                    ? "detail.learn.lessonArticleDraftNoticeBody"
                    : "detail.learn.lessonDraftNoticeBody",
                )}
              </p>
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">
              {translate("detail.learn.currentLesson.selectAside")}
            </p>
          )}
        </div>
      ) : null}

      <div className="px-4 py-4 pb-8 sm:px-6">
        {lesson ? (
          <>
            {videoLesson && lesson.description_markdown?.trim() ? (
              <div className="rounded-2xl border border-border-subtle bg-surface-raised p-5 text-[15px] leading-[1.7]">
                <Markdown content={lesson.description_markdown} />
              </div>
            ) : null}
            {lesson.resources?.length ? (
              <div
                className={cn(
                  "rounded-2xl border border-border-subtle bg-surface-base p-4",
                  (videoLesson && lesson.description_markdown?.trim()) || showArticleBody
                    ? "mt-4"
                    : "",
                )}
              >
                <p className="text-[13px] font-semibold text-foreground">
                  {translate("detail.learn.lessonResourcesTitle")}
                </p>
                <ul className="mt-2 space-y-1 text-[13px]">
                  {lesson.resources
                    .map((r) => ({
                      title: (r.title ?? "").trim(),
                      url: (r.url ?? "").trim(),
                    }))
                    .filter((r) => r.title && r.url)
                    .map((r) => (
                      <li key={r.url} className="truncate">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline underline-offset-4 transition-opacity duration-150 hover:opacity-80"
                        >
                          {r.title}
                        </a>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center sm:w-auto"
                onClick={onMarkComplete}
                disabled={completed || !hasFullCourseAccess || draftForDisplay}
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden />{" "}
                {completed
                  ? translate("detail.learn.markComplete.done")
                  : practiceLesson
                    ? translate("detail.learn.markComplete.actionPractice")
                    : articleLesson
                      ? translate("detail.learn.markComplete.actionArticle")
                      : translate("detail.learn.markComplete.action")}
              </Button>
              {previousLesson ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center sm:w-auto"
                  onClick={() => onNavigateToLesson(previousLesson.id)}
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden />{" "}
                  {translate("detail.learn.nav.previous")}
                </Button>
              ) : null}
              {nextLesson ? (
                <Button
                  size="sm"
                  className="w-full justify-center sm:w-auto"
                  onClick={() => onNavigateToLesson(nextLesson.id)}
                >
                  {translate("detail.learn.nav.next")}{" "}
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
