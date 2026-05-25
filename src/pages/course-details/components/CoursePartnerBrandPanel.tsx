import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import type { Course, CoursePartner, SupportedCourseLocale } from "@/types/courses";
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

export function CoursePartnerBrandPanel({
  course,
}: {
  course: Pick<Course, "partner_brand" | "partners">;
}) {
  const { t } = useTranslation("courses");
  const translate = (key: string, options?: Record<string, unknown>) =>
    String(t(key as never, options as never));
  const currentLocale = normalizeCourseLocale(i18n.language) as SupportedCourseLocale;

  const legacy = course.partner_brand ?? null;
  const legacyName = String(legacy?.name ?? "").trim();
  const legacyPartner: CoursePartner | null = legacyName
    ? {
        id: "legacy",
        name: legacyName,
        website: legacy?.website ?? null,
        description: legacy?.description ?? null,
        logo_url: legacy?.logo_url ?? null,
        logo_path: legacy?.logo_path ?? null,
      }
    : null;

  const list = Array.isArray(course.partners) ? course.partners : [];
  const visible = [
    ...list.map((p) => {
      const lc = p.locale_content?.[currentLocale];
      return {
        ...p,
        id: String(p.id ?? "").trim(),
        name: (lc?.name?.trim() || p.name || "").trim(),
        description: lc?.description?.trim() || p.description || null,
      };
    }),
    ...(legacyPartner ? [legacyPartner] : []),
  ].filter((p) => p.id && p.name);

  if (visible.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-medium text-foreground">
          {translate("detail.courseDetail.partnerBrand.title")}
        </h3>

        <div className="mt-3 space-y-3">
          {visible.map((p) => {
            const website = isValidHttpUrl(p.website) ? String(p.website) : null;
            const hasDescription = Boolean(p.description && p.description.trim());
            const logoSrc = p.logo_url && p.logo_url.trim() ? p.logo_url : null;

            return (
              <div
                key={p.id}
                className="flex items-start gap-3 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-3"
              >
                <div className="shrink-0">
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt={p.name}
                      loading="lazy"
                      decoding="async"
                      className="size-10 rounded-2xl border border-border-subtle bg-surface-base shadow-card object-contain"
                    />
                  ) : (
                    <div className="grid size-10 place-items-center rounded-md border border-border-subtle bg-surface-raised text-xs font-semibold text-foreground-muted">
                      {p.name.slice(0, 2).toUpperCase()}
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
                        {p.name}
                      </a>
                    ) : (
                      p.name
                    )}
                  </div>

                  {hasDescription ? (
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground-muted">
                      {p.description}
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
                      {translate("detail.courseDetail.partnerBrand.websiteLabel")}
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

