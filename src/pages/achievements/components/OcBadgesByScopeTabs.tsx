import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { BadgeCard } from "./BadgeCard";
import type { BadgeItem, ModalItem } from "../types";

type TabKey = "all" | "oca" | "ocb" | "activity_milestone";

export function OcBadgesByScopeTabs({
  badges,
  loading,
  onOpenModal,
  onRetry,
  emptyLabel,
  layout = "tabs",
}: {
  badges: BadgeItem[];
  loading: boolean;
  onOpenModal: (item: ModalItem) => void;
  onRetry?: (badge: BadgeItem) => Promise<void>;
  emptyLabel?: string;
  /** "tabs" giữ nguyên cách cũ (nút lọc); "sections" chia hai nhóm theo Figma cho hồ sơ. */
  layout?: "tabs" | "sections";
}) {
  const { t } = useTranslation("common");
  const [tab, setTab] = useState<TabKey>("all");

  const buckets = useMemo(() => {
    return {
      all: badges,
      oca: badges.filter(
        (b) =>
          b.credentialScope !== "activity_milestone" &&
          b.achievementType !== "Badge" &&
          b.achievementType !== "Award",
      ),
      ocb: badges.filter(
        (b) =>
          b.credentialScope !== "activity_milestone" &&
          (b.achievementType === "Badge" || b.achievementType === "Award"),
      ),
      activity_milestone: badges.filter((b) => b.credentialScope === "activity_milestone"),
    };
  }, [badges]);

  const current = buckets[tab];

  const tabs: { key: TabKey; label: string }[] = [
    {
      key: "all",
      label: t("achievements.ocVault.tabs.all", { defaultValue: "Tất cả" }),
    },
    {
      key: "oca",
      label: t("achievements.ocVault.tabs.oca", { defaultValue: "Achievements (OCA)" }),
    },
    {
      key: "ocb",
      label: t("achievements.ocVault.tabs.ocb", { defaultValue: "Badges (OCB)" }),
    },
    {
      key: "activity_milestone",
      label: t("achievements.ocVault.tabs.milestones", { defaultValue: "Milestones" }),
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Loader2 className="size-6 animate-spin text-foreground-muted" aria-hidden />
        <p className="text-sm font-medium text-foreground">{t("achievements.vaults.badges.loading")}</p>
      </div>
    );
  }

  if (layout === "sections") {
    const groups = [
      { key: "certificates", title: t("userProfile.achievements.certificatesTitle"), items: buckets.oca, variant: "certificate" as const, columns: "sm:grid-cols-2" },
      { key: "badges", title: t("userProfile.achievements.badgesTitle"), items: [...buckets.ocb, ...buckets.activity_milestone], variant: "badge" as const, columns: "grid-cols-2 sm:grid-cols-3" },
    ].filter((group) => group.items.length > 0);
    if (groups.length === 0) {
      return <p className="text-sm text-foreground-muted">{emptyLabel ?? t("achievements.ocVault.empty", { defaultValue: "No badges in this category yet." })}</p>;
    }
    return (
      <div className="flex flex-col gap-12">
        {groups.map((group) => (
          <section key={group.key} aria-label={group.title} className="flex flex-col gap-4">
            <SectionHeader title={group.title} />
            <ul className={cn("grid gap-6", group.columns)}>
              {group.items.map((badge) => (
                <li key={badge.id} className="min-w-0">
                  <BadgeCard badge={badge} variant={group.variant} onOpenModal={onOpenModal} onRetry={onRetry} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-border-subtle pb-2">
        {tabs.map((x) => (
          <Button
            key={x.key}
            type="button"
            variant="cta"
            hierarchy={tab === x.key ? "primary" : "tertiary"}
            size="small"
            className={cn(
              "rounded-full",
              tab === x.key ? "" : "text-foreground-muted",
            )}
            onClick={() => setTab(x.key)}
          >
            {x.label}{" "}
            <span className="tabular-nums text-foreground-muted">({buckets[x.key].length})</span>
          </Button>
        ))}
      </div>

      {current.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6 text-sm text-foreground-muted">
          {emptyLabel ?? t("achievements.ocVault.empty", { defaultValue: "No badges in this category yet." })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
          {current.map((badge) => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              onOpenModal={onOpenModal}
              onRetry={onRetry}
            />
          ))}
        </div>
      )}
    </div>
  );
}
