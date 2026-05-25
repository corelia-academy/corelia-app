import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import type { CourseSponsor, SupportedCourseLocale } from "@/types/courses";
import { normalizeCourseLocale } from "@/lib/courses";

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
  const currentLocale = normalizeCourseLocale(i18n.language) as SupportedCourseLocale;

  const list = Array.isArray(sponsors) ? sponsors : [];
  const visible = list
    .map((s) => {
      const lc = s.locale_content?.[currentLocale];
      return {
        ...s,
        id: String(s.id ?? "").trim(),
        name: (lc?.name?.trim() || s.name || "").trim(),
        description: lc?.description?.trim() || s.description || null,
      };
    })
    .filter((s) => s.id && s.name);

  if (visible.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
          {translate("detail.courseDetail.sponsors.title")}
        </p>

        <div className="mt-3 space-y-3">
          {visible.map((s) => {
            const website = isValidHttpUrl(s.website) ? String(s.website) : null;
            const hasDescription = Boolean(s.description && s.description.trim());
            const logoSrc = s.logo_url && s.logo_url.trim() ? s.logo_url : null;

            return (
              <div
                key={s.id}
                className="rounded-2xl border border-border-subtle bg-surface-base shadow-card overflow-hidden"
              >
                {/* Logo strip */}
                <div className="flex items-center justify-center bg-surface-raised px-4 py-5 border-b border-border-subtle">
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt={s.name}
                      loading="lazy"
                      decoding="async"
                      className="h-10 max-w-[120px] object-contain"
                    />
                  ) : (
                    <span className="text-base font-bold tracking-tight text-foreground">
                      {s.name}
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="px-4 py-3 space-y-2">
                  <p className="text-sm font-semibold text-foreground leading-snug">
                    {s.name}
                  </p>

                  {hasDescription ? (
                    <p className="line-clamp-3 text-xs leading-relaxed text-foreground-muted">
                      {s.description}
                    </p>
                  ) : null}

                  {website ? (
                    <a
                      href={website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
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

