import { describe, expect, it } from "vitest";

import {
  claimStatusFromIssuance,
  shouldUseSavedCourseIssuance,
} from "./credentialState";

describe("credential state regression cases", () => {
  it.each([
    ["minted with an ID", { status: "minted", ocCredentialId: "oc-123" }, "claimed"],
    ["minted without an ID", { status: "minted", ocCredentialId: null }, "needs_reconciliation"],
    ["failed", { status: "failed", ocCredentialId: null }, "failed"],
    ["awaiting holder", { status: "pending", errorMessage: "awaiting_holder_id" }, "awaiting_holder_id"],
    ["pending", { status: "pending" }, "pending"],
  ] as const)("maps %s to %s", (_label, input, expected) => {
    expect(claimStatusFromIssuance(input)).toBe(expected);
  });

  it("does not pin a learner to a failed template after replacement", () => {
    expect(
      shouldUseSavedCourseIssuance(
        {
          templateId: "old-template",
          status: "failed",
          error_message: "issuer unavailable",
        },
        "new-template",
      ),
    ).toBe(false);
  });

  it("keeps a minted historical template to prevent duplicate issuance", () => {
    expect(
      shouldUseSavedCourseIssuance(
        {
          templateId: "old-template",
          status: "minted",
          oc_credential_id: "oc-123",
        },
        "new-template",
      ),
    ).toBe(true);
  });
});
