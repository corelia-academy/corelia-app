import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown/Markdown";
import { getYoutubeEmbedUrlForLesson } from "@/types/courses";
import type { CourseLesson } from "@/types/courses";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { LearnBadge } from "./LearnBadge";

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
}) {
  const embedUrl = lesson?.youtube_url?.trim()
    ? getYoutubeEmbedUrlForLesson(lesson)
    : null;

  const autoplayEmbedUrl = (() => {
    if (!embedUrl) return null;
    const u = new URL(embedUrl);
    u.searchParams.set("autoplay", "1");
    return u.toString();
  })();

  const isTextLesson =
    !!lesson && !embedUrl && !!lesson.description_markdown?.trim();

  return (
    <div>
      {lesson && autoplayEmbedUrl ? (
        <div className="relative aspect-video w-full bg-black">
          <iframe
            key={lesson.id}
            src={autoplayEmbedUrl}
            title={lesson.title}
            className="absolute inset-0 size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : isTextLesson ? (
        <div className="px-1 py-6">
          <Markdown content={lesson!.description_markdown!} />
        </div>
      ) : lesson ? (
        <div className="flex aspect-video items-center justify-center rounded-md border border-border-subtle bg-surface-raised">
          {isDraftLesson ? (
            <div className="max-w-md px-6 text-center">
              <p className="text-sm font-medium text-foreground">
                {translate("detail.learn.lessonDraftNoticeTitle")}
              </p>
              <p className="mt-2 text-sm text-foreground-muted">
                {translate("detail.learn.lessonDraftNoticeBody")}
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
            <div className="flex flex-wrap items-center gap-2">
              <LearnBadge variant="primaryContainer">
                {translate("detail.learn.lessonNumberBadge", {
                  index: (lessonIndex ?? 0) + 1,
                })}
              </LearnBadge>
              {completed ? (
                <LearnBadge variant="success">
                  {translate("detail.learn.completedBadge")}
                </LearnBadge>
              ) : null}
            </div>
            <h2 className="mt-3 text-xl font-semibold text-foreground">
              {lesson.title}
            </h2>
            {lesson.short_description?.trim() ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground-muted">
                {lesson.short_description}
              </p>
            ) : null}
            {!isTextLesson && lesson.description_markdown?.trim() ? (
              <div className="mt-4 rounded-md border border-border-subtle bg-surface-raised p-4">
                <Markdown content={lesson.description_markdown} />
              </div>
            ) : null}
            {lesson.resources?.length ? (
              <div className="mt-4 rounded-md border border-border-subtle bg-surface-base p-4">
                <p className="text-sm font-medium text-foreground">
                  {translate("detail.learn.lessonResourcesTitle")}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
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
                variant="outline"
                size="sm"
                className="w-full justify-center sm:w-auto"
                onClick={onMarkComplete}
                disabled={completed || !hasFullCourseAccess || isDraftLesson}
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden />{" "}
                {completed
                  ? translate("detail.learn.markComplete.done")
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
