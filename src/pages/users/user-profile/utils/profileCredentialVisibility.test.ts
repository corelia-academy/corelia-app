import { describe, expect, it } from "vitest";

import type { BadgeItem } from "@/pages/achievements/types";

import {
  isEligibleProfileCredential,
  profileCredentialBelongsToTab,
  profileCredentialSetsEqual,
} from "./profileCredentialVisibility";

function badge(overrides: Partial<BadgeItem> = {}): BadgeItem {
  return {
    id: "issuance-1",
    title: "Credential",
    description: "Description",
    icon: null,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    earnedAt: "01/01/2026",
    locked: false,
    category: "milestone",
    ocClaimStatus: "claimed",
    issuanceId: "issuance-1",
    mintCredentialId: "oc-credential-1",
    credentialScope: "course",
    achievementType: "CertificateOfCompletion",
    ...overrides,
  };
}

describe("profile credential visibility", () => {
  it("only permits resolved claimed issuances", () => {
    expect(isEligibleProfileCredential(badge())).toBe(true);
    expect(isEligibleProfileCredential(badge({ ocClaimStatus: "pending" }))).toBe(false);
    expect(isEligibleProfileCredential(badge({ mintCredentialId: null }))).toBe(false);
    expect(isEligibleProfileCredential(badge({ issuanceId: undefined }))).toBe(false);
  });

  it("detects selection changes, including clear-all", () => {
    expect(profileCredentialSetsEqual(new Set(["a"]), new Set(["a"]))).toBe(true);
    expect(profileCredentialSetsEqual(new Set(["a"]), new Set())).toBe(false);
    expect(profileCredentialSetsEqual(new Set(["a", "b"]), new Set(["a"]))).toBe(false);
  });

  it("uses the same OCA, OCB, and milestone buckets as the vault", () => {
    const oca = badge();
    const ocb = badge({ achievementType: "Badge" });
    const milestone = badge({ credentialScope: "activity_milestone" });

    expect(profileCredentialBelongsToTab(oca, "oca")).toBe(true);
    expect(profileCredentialBelongsToTab(ocb, "ocb")).toBe(true);
    expect(profileCredentialBelongsToTab(milestone, "activity_milestone")).toBe(true);
    expect(profileCredentialBelongsToTab(milestone, "oca")).toBe(false);
  });
});
