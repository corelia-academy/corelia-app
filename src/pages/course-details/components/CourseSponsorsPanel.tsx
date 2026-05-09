import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import type { CourseSponsor } from "@/types/courses";

function isValidHttpUrl(input?: string | null): boolean {
  const value = String(input ?? "").trim();
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function CourseSponsorsPanel({
  sponsors,
}: {
  sponsors?: CourseSponsor[] | null;
}) {
  const { t } = useTranslation("courses");
  const translate = (key: string, options?: Record<string, unknown>) =>
    String(t(key as never, options as never));

  const list = Array.isArray(sponsors) ? sponsors : [];
  const visible = list
    .map((s) => ({
      ...s,
      id: String(s.id ?? "").trim(),
      name: String(s.name ?? "").trim(),
    }))
    .filter((s) => s.id && s.name);

  if (visible.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-medium text-foreground">
          {translate("detail.courseDetail.sponsors.title")}
        </h3>

        <div className="mt-3 space-y-3">
          {visible.map((s) => {
            const website = isValidHttpUrl(s.website) ? String(s.website) : null;
            const hasDescription = Boolean(s.description && s.description.trim());
            const logoSrc = s.logo_url && s.logo_url.trim() ? s.logo_url : null;

            return (
              <div
                key={s.id}
                className="flex items-start gap-3 rounded-md border border-border-subtle bg-surface-base p-3"
              >
                <div className="shrink-0">
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt={s.name}
                      loading="lazy"
                      decoding="async"
                      className="size-10 rounded-md border border-border-subtle bg-surface-base object-contain"
                    />
                  ) : (
                    <div className="grid size-10 place-items-center rounded-md border border-border-subtle bg-surface-raised text-xs font-semibold text-foreground-muted">
                      {s.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">
                    {website ? (
                      <a
                        href={website}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {s.name}
                      </a>
                    ) : (
                      s.name
                    )}
                  </div>

                  {hasDescription ? (
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground-muted">
                      {s.description}
                    </p>
                  ) : null}

                  {website ? (
                    <a
                      href={website}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-xs text-primary hover:underline"
                    >
                      <Globe className="size-3.5" aria-hidden />
                      {translate("detail.courseDetail.sponsors.websiteLabel")}
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

