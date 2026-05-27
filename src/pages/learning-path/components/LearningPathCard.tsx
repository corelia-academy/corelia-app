import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Briefcase, Calendar, ChevronDown, ChevronUp, Compass, Target, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LearningPath } from "@/lib/learningPaths";

type Props = {
  path: LearningPath;
  onDelete: (id: string) => void;
};

export function LearningPathCard({ path, onDelete }: Props) {
  const { t } = useTranslation("learningPath");
  const [expanded, setExpanded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <article className="rounded-2xl border border-border-subtle bg-surface-raised">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 p-5">
        <div className="flex items-start gap-2 min-w-0">
          <Target className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{path.goal}</p>
            {path.summary ? (
              <p className="mt-0.5 text-xs leading-relaxed text-foreground-muted">
                {path.summary}
              </p>
            ) : null}
            <p className="mt-1 text-[11px] text-foreground-subtle">
              {path.estimatedWeeks
                ? t("card.estimatedWeeks", {
                    weeks: path.estimatedWeeks,
                    defaultValue: "~{{weeks}} tuần",
                  })
                : null}
              {path.estimatedWeeks ? " · " : ""}
              {t("card.coursesCount", {
                count: path.recommendedCourses.length,
                defaultValue: "{{count}} courses",
              })}
              {path.recommendedTracks.length > 0
                ? ` · ${t("card.tracksCount", {
                    count: path.recommendedTracks.length,
                    defaultValue: "{{count}} tracks",
                  })}`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            aria-label={String(
              t("card.toggle", { defaultValue: expanded ? "Thu gọn" : "Mở rộng" }),
            )}
            className="h-8 px-2"
          >
            {expanded ? (
              <ChevronUp className="size-4" aria-hidden />
            ) : (
              <ChevronDown className="size-4" aria-hidden />
            )}
          </Button>
          {confirmingDelete ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onDelete(path.id);
                setConfirmingDelete(false);
              }}
            >
              {t("card.confirmDelete", { defaultValue: "Xóa hẳn" })}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDelete(true)}
              aria-label={String(t("card.delete", { defaultValue: "Xóa" }))}
              className="h-8 px-2 text-foreground-muted hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </header>

      {expanded ? (
        <div className="space-y-5 border-t border-border-subtle p-5">
          {/* Milestones */}
          {path.milestones.length > 0 ? (
            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                {t("card.milestonesLabel", { defaultValue: "Milestones" })}
              </h4>
              <ol className="mt-2 space-y-2">
                {path.milestones
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((m) => (
                    <li
                      key={`${path.id}-m-${m.order}`}
                      className="rounded-md border border-border-subtle bg-surface-base px-3 py-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {m.order}. {m.title}
                        </p>
                        <span className="shrink-0 text-[11px] text-foreground-muted">
                          {t("card.weeksShort", {
                            count: m.weeks,
                            defaultValue: "{{count}} tuần",
                          })}
                        </span>
                      </div>
                      {m.description ? (
                        <p className="mt-0.5 text-xs leading-relaxed text-foreground-muted">
                          {m.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
              </ol>
            </section>
          ) : null}

          {/* Recommended courses */}
          {path.recommendedCourses.length > 0 ? (
            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                {t("card.coursesLabel", { defaultValue: "Courses đề xuất" })}
              </h4>
              <ul className="mt-2 space-y-2">
                {path.recommendedCourses
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((c) => (
                    <li
                      key={`${path.id}-c-${c.id}`}
                      className="rounded-md border border-border-subtle bg-surface-base px-3 py-2"
                    >
                      <Link
                        to={c.slug ? `/courses/${c.slug}` : `/courses/${c.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {c.order}. {c.title}
                      </Link>
                      {c.reason ? (
                        <p className="mt-0.5 text-xs leading-relaxed text-foreground-muted">
                          {c.reason}
                        </p>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          {/* Recommended tracks */}
          {path.recommendedTracks.length > 0 ? (
            <section>
              <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                <Briefcase className="size-3" aria-hidden />
                {t("card.tracksLabel", { defaultValue: "Career tracks" })}
              </h4>
              <ul className="mt-2 space-y-2">
                {path.recommendedTracks
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((tr) => (
                    <li
                      key={`${path.id}-tr-${tr.slug}`}
                      className="rounded-md border border-border-subtle bg-surface-base px-3 py-2"
                    >
                      <Link
                        to={`/career/${tr.slug}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {tr.title}
                      </Link>
                      {tr.reason ? (
                        <p className="mt-0.5 text-xs leading-relaxed text-foreground-muted">
                          {tr.reason}
                        </p>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          {/* Weekly plan */}
          {path.weeklyPlan.length > 0 ? (
            <section>
              <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                <Calendar className="size-3" aria-hidden />
                {t("card.weeklyLabel", { defaultValue: "Kế hoạch theo tuần" })}
              </h4>
              <ul className="mt-2 space-y-1.5">
                {path.weeklyPlan
                  .slice()
                  .sort((a, b) => a.week - b.week)
                  .map((w) => (
                    <li
                      key={`${path.id}-w-${w.week}`}
                      className="rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-xs"
                    >
                      <p className="font-medium text-foreground">
                        {t("card.weekLabel", {
                          week: w.week,
                          defaultValue: "Tuần {{week}}",
                        })}
                        {w.focus ? <span className="text-foreground-muted"> · {w.focus}</span> : null}
                      </p>
                      {w.actions.length > 0 ? (
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-foreground-muted">
                          {w.actions.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          <p className="text-[11px] text-foreground-subtle">
            <Compass className="mr-1 inline size-3" aria-hidden />
            {t("card.disclaimer", {
              defaultValue:
                "Cora gợi ý dựa trên catalog hiện tại. Bạn có thể điều chỉnh trình tự theo nhu cầu.",
            })}
          </p>
        </div>
      ) : null}
    </article>
  );
}

