import { Link } from "react-router";
import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CourseCoInstructorSnapshot } from "@/types/courses";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CourseCoInstructorsSectionProps {
  coInstructors: CourseCoInstructorSnapshot[];
}

function initials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase() || "?";
}

export function CourseCoInstructorsSection({
  coInstructors,
}: CourseCoInstructorsSectionProps) {
  const { t } = useTranslation("courses");
  const translate = (key: string, options?: Record<string, unknown>) =>
    String(t(key as never, options as never));

  if (!coInstructors || coInstructors.length === 0) return null;

  return (
    <section className="rounded-md border border-border-subtle bg-card p-4 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-foreground">
        {translate("detail.courseDetail.coInstructors.title")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {translate("detail.courseDetail.coInstructors.subtitle")}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {coInstructors.map((p) => {
          const label = (p.name ?? "").trim() || translate("detail.courseDetail.coInstructors.fallbackName");
          const fallback = initials(label);
          const meta = [p.headline, p.organization].filter(Boolean).join(" • ");
          const hasBio = Boolean(p.bio && p.bio.trim().length > 0);
          const hasWebsite = Boolean(p.website && p.website.trim().length > 0);

          return (
            <div
              key={p.id}
              className="rounded-md border border-border-subtle bg-background p-4"
            >
              <div className="flex items-start gap-3">
                <Avatar className="mt-0.5 size-10 rounded-full border border-border-subtle">
                  <AvatarImage src={p.avatar_url || undefined} alt={label} />
                  <AvatarFallback>{fallback}</AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">
                    <Link
                      to={`/instructors/${p.id}`}
                      className="hover:underline"
                    >
                      {label}
                    </Link>
                  </div>
                  {meta ? (
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {meta}
                    </div>
                  ) : null}

                  {hasBio ? (
                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {p.bio}
                    </p>
                  ) : null}

                  {hasWebsite ? (
                    <a
                      href={p.website as string}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Globe className="size-4" aria-hidden />
                      {translate("detail.courseDetail.coInstructors.websiteLabel")}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

