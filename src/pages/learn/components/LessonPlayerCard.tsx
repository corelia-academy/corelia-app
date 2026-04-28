import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown/Markdown";
import { cn } from "@/lib/utils";
import { formatDuration, getYoutubeEmbedUrl } from "@/types/courses";
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
  const embedUrl =
    lesson?.youtube_url?.trim() ? getYoutubeEmbedUrl(lesson.youtube_url) : null;

  return (
    <div className="overflow-hidden rounded-md border border-border-subtle bg-card shadow-sm">
      <div className="border-b border-border-subtle bg-muted/30 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {translate("detail.learn.currentLesson.label")}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {lesson?.title ??
                translate("detail.learn.currentLesson.selectFromList")}
            </p>
          </div>
          {lesson ? (
            <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {formatDuration(lesson.duration_seconds)}
            </div>
          ) : null}
        </div>
      </div>

      {lesson && embedUrl ? (
        <div className="relative aspect-video w-full bg-black">
          <iframe
            src={embedUrl}
            title={lesson.title}
            className="absolute inset-0 size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center bg-muted/50">
          {lesson && isDraftLesson ? (
            <div className="max-w-md px-6 text-center">
              <p className="text-sm font-medium text-foreground">
                {translate("detail.learn.lessonDraftNoticeTitle")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {translate("detail.learn.lessonDraftNoticeBody")}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {translate("detail.learn.currentLesson.selectAside")}
            </p>
          )}
        </div>
      )}

      <div className="border-t border-border-subtle p-4 sm:p-5">
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
            <h2 className="mt-3 text-lg font-semibold text-foreground">
              {lesson.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {translate("detail.learn.lessonHint")}
            </p>
            {lesson.short_description?.trim() ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {lesson.short_description}
              </p>
            ) : null}
            {lesson.description_markdown?.trim() ? (
              <div className="mt-4 rounded-md border border-border-subtle bg-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">
                  {translate("detail.learn.lessonAboutTitle")}
                </p>
                <div className="mt-3">
                  <Markdown content={lesson.description_markdown} />
                </div>
              </div>
            ) : null}
            {lesson.resources?.length ? (
              <div className="mt-4 rounded-md border border-border-subtle bg-card p-4">
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

            <div className={cn("mt-4 flex flex-col gap-2 sm:flex-row")}>
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
