import { describe, expect, it } from "vitest";
import { summarizeBlastRecipients } from "./recipient_accounting.ts";

describe("summarizeBlastRecipients", () => {
  it("accounts for opt-outs, missing addresses, and duplicate addresses", () => {
    expect(
      summarizeBlastRecipients({
        totalRecipients: 10,
        optedInRecipients: 8,
        resolvedEmails: ["a@example.com", "b@example.com", "", "c@example.com", "d@example.com", "e@example.com", "f@example.com", "a@example.com"],
      }),
    ).toEqual({
      emails: ["a@example.com", "b@example.com", "c@example.com", "d@example.com", "e@example.com", "f@example.com"],
      skipped: 4,
      skippedBreakdown: { optedOut: 2, noEmail: 1, duplicateEmail: 1 },
    });
  });
});
