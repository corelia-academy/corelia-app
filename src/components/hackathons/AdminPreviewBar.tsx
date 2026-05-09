import { NavLink, useLocation } from "react-router";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";

type AdminPreviewBarProps = {
  title?: string | null;
  statusLabel?: string | null;
  primaryAction?: { label: string; to: string } | null;
};

const SESSION_KEY = "corelia.contests.previewBar.dismissed";

export function AdminPreviewBar({ title, statusLabel, primaryAction }: AdminPreviewBarProps) {
  const { t } = useTranslation("contests");
  const location = useLocation();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");

  const isPublicContestSurface = useMemo(() => {
    const pathname = location.pathname;
    return pathname === "/hackathons" || pathname.startsWith("/hackathons/");
  }, [location.pathname]);

  if (!isPublicContestSurface || dismissed) return null;

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-border-subtle bg-surface-raised px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1990px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-overlay px-3 py-1 text-xs font-medium text-foreground">
              <Eye className="size-3.5" aria-hidden />
              {t("previewBar.label")}
            </span>
            {statusLabel ? (
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-overlay px-3 py-1 text-xs font-medium text-foreground">
                {t("previewBar.statusPrefix", { status: statusLabel })}
              </span>
            ) : null}
          </div>
          {title?.trim() ? (
            <div className="mt-1 truncate text-sm font-medium text-foreground">{title}</div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {primaryAction ? (
            <Button
              size="sm"
              render={<NavLink to={primaryAction.to} />}
              nativeButton={false}
            >
              {primaryAction.label}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => {
              sessionStorage.setItem(SESSION_KEY, "1");
              setDismissed(true);
            }}
          >
            <X className="size-4" aria-hidden />
            {t("previewBar.exit")}
          </Button>
        </div>
      </div>
    </div>
  );
}

