import type { BadgeItem } from "@/pages/achievements/types";

export type ProfileCredentialVaultTab = "all" | "oca" | "ocb" | "activity_milestone";

export type ProfileEligibleCredential = BadgeItem & { issuanceId: string };

export function isEligibleProfileCredential(
  badge: BadgeItem,
): badge is ProfileEligibleCredential {
  return Boolean(
    badge.issuanceId &&
      badge.ocClaimStatus === "claimed" &&
      badge.mintCredentialId?.trim(),
  );
}

export function profileCredentialSetsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  return [...left].every((id) => right.has(id));
}

export function profileCredentialBelongsToTab(
  badge: BadgeItem,
  tab: ProfileCredentialVaultTab,
): boolean {
  if (tab === "all") return true;
  if (tab === "activity_milestone") {
    return badge.credentialScope === "activity_milestone";
  }
  if (tab === "ocb") {
    return (
      badge.credentialScope !== "activity_milestone" &&
      (badge.achievementType === "Badge" || badge.achievementType === "Award")
    );
  }
  return (
    badge.credentialScope !== "activity_milestone" &&
    badge.achievementType !== "Badge" &&
    badge.achievementType !== "Award"
  );
}
