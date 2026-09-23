import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { visibleCourseResources } from "@/features/courses/courseResources";
import { cn } from "@/lib/utils";
import { CourseResourceIcon } from "./CourseResourceIcon";

export function CourseResources({ resources, showEmpty = false, className }: {
  resources: unknown;
  showEmpty?: boolean;
  className?: string;
}) {
  const { t } = useTranslation("courses");
  const items = visibleCourseResources(resources);
  if (!items.length && !showEmpty) return null;
  return (
    <section className={cn("rounded-xl border border-border-subtle bg-surface-base p-4", className)}>
      <h2 className="font-display text-heading-small text-foreground">{t("courseResources.title")}</h2>
      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((resource, index) => (
            <li key={index}>
              <a href={resource.url} target="_blank" rel="noopener noreferrer"
                className="flex min-h-11 items-center gap-2 rounded-md px-2 py-2 text-sm text-primary underline-offset-4 hover:bg-surface-raised hover:underline focus-visible:outline-2 focus-visible:outline-primary">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border-subtle bg-surface-raised text-foreground-muted">
                  <CourseResourceIcon icon={resource.icon} />
                </span>
                <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{resource.title}</span>
                <ExternalLink className="size-4 shrink-0" aria-hidden />
                <span className="sr-only">{t("courseResources.opensNewTab")}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-foreground-muted">{t("courseResources.empty")}</p>}
    </section>
  );
}
