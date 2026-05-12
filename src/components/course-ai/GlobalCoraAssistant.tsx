import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, NavLink } from "react-router";
import { ArrowUpRight, Info, MessageSquareText, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/stores/authStore";
import { cn } from "@/lib/utils";

import { CORA_AI_TUTOR_LOGO_SRC } from "./constants";
import { CoraShell } from "./CoraShell";
import {
  getAssistantSurfaceMeta,
  resolveAssistantContext,
} from "./context";
import { shouldShowGlobalCoraAssistant } from "./visibility";

const CORA_WIDGET_COLLAPSED_KEY = "corelia-cora-widget-collapsed";

function CoraAssistantCard({
  pathname,
  isAuthenticated,
  compact,
  onRequestHide,
}: {
  pathname: string;
  isAuthenticated: boolean;
  compact?: boolean;
  onRequestHide?: () => void;
}) {
  const { t } = useTranslation("common");
  const context = resolveAssistantContext(pathname);
  const surface = getAssistantSurfaceMeta(context);

  const rawSuggestions = t(surface.suggestionsKey, { returnObjects: true });
  const suggestions = Array.isArray(rawSuggestions) ? (rawSuggestions as string[]) : [];

  const handleSuggestionClick = () => {
    toast.message(String(t("coraWidget.chipToast")));
  };

  return (
    <CoraShell
      eyebrow={String(t("coraWidget.eyebrow"))}
      title={String(t("coraWidget.title"))}
      status={String(t("coraWidget.status"))}
      description={String(t("coraWidget.description"))}
      onRequestHide={onRequestHide}
      hideLabel={String(t("coraWidget.hideAction"))}
      className="max-h-[min(78vh,640px)]"
      body={
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="rounded-lg border border-border-subtle bg-surface-raised p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted">
              <Target className="size-3.5" aria-hidden />
              {t("coraWidget.contextLabel")}
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{t(surface.titleKey)}</p>
            <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
              {isAuthenticated ? t(surface.descriptionKey) : t("coraWidget.contextDescription.guest")}
            </p>
          </div>

          <div className="flex gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2.5 text-[11px] leading-snug text-foreground-muted">
            <Info className="mt-px size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
            <p>{t("coraWidget.comingSoonHint")}</p>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
              <Sparkles className="size-3.5" aria-hidden />
              {t("coraWidget.suggestionsLabel")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((label) => (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    "max-w-full rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1 text-left text-[11px] leading-snug text-foreground-muted",
                    "transition-colors hover:border-border hover:bg-surface-overlay hover:text-foreground",
                  )}
                  onClick={handleSuggestionClick}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      }
      footer={
        <>
          <textarea
            disabled
            rows={compact ? 2 : 3}
            placeholder={String(t("coraWidget.inputPlaceholder"))}
            className={cn(
              "w-full resize-none rounded-md border border-border bg-surface-base px-3 py-2 text-sm text-foreground outline-none",
              "placeholder:text-foreground-subtle",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] leading-snug text-foreground-muted">
              {t("coraWidget.footerCaption")}
            </p>
            <Button
              render={<NavLink to={surface.action.to} />}
              nativeButton={false}
              variant="ghost"
              size="sm"
              className="shrink-0"
            >
              {t(surface.action.label)}
              <ArrowUpRight className="size-4" />
            </Button>
          </div>
        </>
      }
    />
  );
}

export function GlobalCoraAssistant() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation("common");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [desktopReady, setDesktopReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CORA_WIDGET_COLLAPSED_KEY);
      setDesktopCollapsed(raw === "1");
    } catch {
      setDesktopCollapsed(false);
    } finally {
      setDesktopReady(true);
    }
  }, []);

  useEffect(() => {
    if (!desktopReady) return;
    try {
      window.localStorage.setItem(
        CORA_WIDGET_COLLAPSED_KEY,
        desktopCollapsed ? "1" : "0",
      );
    } catch {
      // Ignore storage failures and keep widget usable.
    }
  }, [desktopCollapsed, desktopReady]);

  if (!shouldShowGlobalCoraAssistant(location.pathname)) {
    return null;
  }

  return (
    <>
      {desktopCollapsed ? (
        <div className="fixed right-5 bottom-20 z-30 hidden xl:block">
          <Button
            type="button"
            variant="secondary"
            className="size-12 rounded-full p-0 shadow-[var(--elevation-3)]"
            onClick={() => setDesktopCollapsed(false)}
            aria-label={String(t("coraWidget.restoreAction"))}
            title={String(t("coraWidget.restoreAction"))}
          >
            <img
              src={CORA_AI_TUTOR_LOGO_SRC}
              alt=""
              className="h-7 w-auto max-w-20 object-contain"
              aria-hidden
            />
          </Button>
        </div>
      ) : (
        <div className="fixed right-5 bottom-20 z-30 hidden w-[360px] xl:block">
          <CoraAssistantCard
            pathname={location.pathname}
            isAuthenticated={isAuthenticated}
            compact
            onRequestHide={() => setDesktopCollapsed(true)}
          />
        </div>
      )}

      <div className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-40 xl:hidden">
        <Button
          type="button"
          onClick={() => setMobileOpen(true)}
          size="lg"
          className="h-12 rounded-full px-4 shadow-[var(--elevation-3)]"
        >
          <MessageSquareText className="size-4" />
          {t("coraWidget.openAction")}
        </Button>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="bottom" className="h-[min(82vh,720px)] max-w-none p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("coraWidget.title")}</SheetTitle>
          </SheetHeader>
          <CoraAssistantCard
            pathname={location.pathname}
            isAuthenticated={isAuthenticated}
            onRequestHide={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
