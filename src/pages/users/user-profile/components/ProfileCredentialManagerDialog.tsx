import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { BadgeItem } from "@/pages/achievements/types";
import {
  isEligibleProfileCredential,
  profileCredentialBelongsToTab,
  profileCredentialSetsEqual,
  type ProfileCredentialVaultTab,
} from "../utils/profileCredentialVisibility";

type ProfileCredentialManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badges: BadgeItem[];
  onApply: (issuanceIds: string[]) => Promise<void>;
};

export function ProfileCredentialManagerDialog({
  open,
  onOpenChange,
  badges,
  onApply,
}: ProfileCredentialManagerDialogProps) {
  const { t } = useTranslation("common");
  const [activeTab, setActiveTab] = useState<ProfileCredentialVaultTab>("all");
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());
  const [persistedIds, setPersistedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const initializedForOpenRef = useRef(false);

  const eligibleBadges = useMemo(
    () => badges.filter(isEligibleProfileCredential),
    [badges],
  );
  const persistedIdsKey = useMemo(
    () =>
      eligibleBadges
        .filter((badge) => badge.showOnProfile)
        .map((badge) => badge.issuanceId)
        .sort()
        .join("|"),
    [eligibleBadges],
  );

  useEffect(() => {
    if (!open) {
      initializedForOpenRef.current = false;
      return;
    }
    if (initializedForOpenRef.current) return;
    const nextPersistedIds = new Set(
      eligibleBadges
        .filter((badge) => badge.showOnProfile)
        .map((badge) => badge.issuanceId),
    );
    setPersistedIds(nextPersistedIds);
    setDraftIds(new Set(nextPersistedIds));
    setActiveTab("all");
    initializedForOpenRef.current = true;
  }, [eligibleBadges, open, persistedIdsKey]);

  const tabs = useMemo(
    () =>
      [
        { key: "all" as const, label: t("achievements.ocVault.tabs.all") },
        { key: "oca" as const, label: t("achievements.ocVault.tabs.oca") },
        { key: "ocb" as const, label: t("achievements.ocVault.tabs.ocb") },
        {
          key: "activity_milestone" as const,
          label: t("achievements.ocVault.tabs.milestones"),
        },
      ].map((tab) => ({
        ...tab,
        count: eligibleBadges.filter((badge) => profileCredentialBelongsToTab(badge, tab.key)).length,
      })),
    [eligibleBadges, t],
  );
  const visibleBadges = eligibleBadges.filter((badge) => profileCredentialBelongsToTab(badge, activeTab));
  const isDirty = !profileCredentialSetsEqual(draftIds, persistedIds);

  function toggleCredential(issuanceId: string) {
    if (saving) return;
    setDraftIds((current) => {
      const next = new Set(current);
      if (next.has(issuanceId)) next.delete(issuanceId);
      else next.add(issuanceId);
      return next;
    });
  }

  function closeWithoutSaving() {
    if (saving) return;
    onOpenChange(false);
  }

  async function handleApply() {
    if (!isDirty || saving) return;
    try {
      setSaving(true);
      const nextIds = [...draftIds];
      await onApply(nextIds);
      setPersistedIds(new Set(nextIds));
      toast.success(t("achievements.profileVisibility.saveSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("achievements.profileVisibility.saveError"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && closeWithoutSaving()}>
      <DialogContent
        showCloseButton={!saving}
        className="flex h-[min(50rem,calc(100svh-2rem))] max-w-6xl flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="shrink-0 border-b border-border-subtle px-5 py-4 sm:px-6">
          <DialogTitle>{t("achievements.profileVisibility.title")}</DialogTitle>
          <DialogDescription>
            {t("achievements.profileVisibility.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {eligibleBadges.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-base p-8 text-center text-sm text-foreground-muted">
              {t("achievements.profileVisibility.empty")}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 border-b border-border-subtle pb-3">
                {tabs.map((tab) => (
                  <Button
                    key={tab.key}
                    type="button"
                    size="sm"
                    variant={activeTab === tab.key ? "secondary" : "ghost"}
                    className={cn("rounded-full", activeTab !== tab.key && "text-foreground-muted")}
                    onClick={() => setActiveTab(tab.key)}
                    disabled={saving}
                  >
                    {tab.label}
                    <span className="tabular-nums text-foreground-muted">({tab.count})</span>
                  </Button>
                ))}
              </div>

              {visibleBadges.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-border-subtle bg-surface-base p-6 text-sm text-foreground-muted">
                  {t("achievements.ocVault.empty")}
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {visibleBadges.map((badge) => {
                    const selected = draftIds.has(badge.issuanceId);
                    return (
                      <button
                        key={badge.issuanceId}
                        type="button"
                        aria-pressed={selected}
                        disabled={saving}
                        onClick={() => toggleCredential(badge.issuanceId)}
                        className={cn(
                          "group relative overflow-hidden rounded-2xl border bg-surface-base text-left shadow-card transition-[transform,border-color] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait",
                          selected
                            ? "border-success/60"
                            : "border-border-subtle hover:border-border",
                        )}
                      >
                        <div className={cn("transition-opacity", selected && "opacity-60")}>
                          <div className="aspect-square bg-surface-raised">
                            {badge.imageUrl ? (
                              <img
                                src={badge.imageUrl}
                                alt=""
                                className="size-full object-cover"
                              />
                            ) : (
                              <div className={cn("flex size-full items-center justify-center", badge.bgColor, badge.color)}>
                                {badge.icon}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 p-3">
                            <p className="line-clamp-2 text-sm font-semibold text-foreground">
                              {badge.title}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-foreground-muted">
                              {badge.description}
                            </p>
                          </div>
                        </div>
                        {selected ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <span className="flex size-12 items-center justify-center rounded-full bg-success text-white shadow-lg">
                              <Check className="size-6" aria-hidden />
                              <span className="sr-only">
                                {t("achievements.profileVisibility.selected")}
                              </span>
                            </span>
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border-subtle bg-surface-float px-5 py-4 sm:px-6">
          <p className="mr-auto text-sm text-foreground-muted">
            {t("achievements.profileVisibility.selectedCount", { count: draftIds.size })}
          </p>
          <Button type="button" variant="outline" onClick={closeWithoutSaving} disabled={saving}>
            {t("actions.cancel")}
          </Button>
          {isDirty ? (
            <Button type="button" onClick={() => void handleApply()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {saving
                ? t("achievements.profileVisibility.applying")
                : t("achievements.profileVisibility.apply")}
            </Button>
          ) : (
            <Button type="button" onClick={closeWithoutSaving} disabled={saving}>
              {t("achievements.profileVisibility.ok")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
