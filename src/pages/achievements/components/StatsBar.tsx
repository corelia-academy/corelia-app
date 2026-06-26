import { Award, Medal, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { BadgeItem, CertificateItem } from "../types";

export function StatsBar({
  certificates,
  badges,
}: {
  certificates: CertificateItem[];
  badges: BadgeItem[];
}) {
  const { t } = useTranslation("common");
  // OCA (course), Badges/OCB (hackathon) and Milestones (activity_milestone)
  // are distinct OpenCampus scopes — never lump them into one "badges" count.
  // Each is counted only when the credential is actually on-chain
  // (ocClaimStatus === "claimed", i.e. oc_credential_id present).
  const ocaCount = badges.filter(
    (b) =>
      !b.locked &&
      b.ocClaimStatus === "claimed" &&
      (b.credentialScope ?? "course") === "course" &&
      b.collectionSymbol !== "ocbadge",
  ).length;

  const badgeCount = badges.filter(
    (b) =>
      !b.locked &&
      b.ocClaimStatus === "claimed" &&
      (b.credentialScope === "hackathon" || b.collectionSymbol === "ocbadge"),
  ).length;

  const milestoneCount = badges.filter(
    (b) =>
      !b.locked &&
      b.ocClaimStatus === "claimed" &&
      b.credentialScope === "activity_milestone",
  ).length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {[
        {
          label: t("achievements.stats.certificates"),
          value: certificates.length,
          icon: <Award className="size-5 text-foreground-muted" aria-hidden />,
        },
        {
          label: t("achievements.stats.oca"),
          value: ocaCount,
          icon: (
            <img
              src="/open-campus-edu-logo.png"
              alt="OC"
              className="size-5 rounded-full"
            />
          ),
        },
        {
          label: t("achievements.stats.badges"),
          value: badgeCount,
          icon: <Medal className="size-5 text-warning" aria-hidden />,
        },
        {
          label: t("achievements.stats.milestones"),
          value: milestoneCount,
          icon: <Trophy className="size-5 text-primary" aria-hidden />,
        },
      ].map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col items-center gap-2 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-3 sm:flex-row sm:gap-3 sm:p-4"
        >
          <div className="shrink-0 rounded-md bg-surface-raised p-2">{stat.icon}</div>
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-xl font-medium tabular-nums leading-none text-foreground sm:text-2xl">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-foreground-muted">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
