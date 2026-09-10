import { beforeEach, describe, expect, it } from "vitest";
import {
  confirmManualLocaleSuccess,
  isAuthSyncLocaleIgnored,
  resetManualLocaleGuard,
  resetManualLocaleIntent,
  rollbackManualLocaleChange,
  startManualLocaleChange,
} from "./localeSyncGuard";

describe("localeSyncGuard", () => {
  beforeEach(() => {
    resetManualLocaleGuard();
  });

  it("does not ignore incoming locale when no manual change occurred", () => {
    expect(isAuthSyncLocaleIgnored("vi")).toBe(false);
    expect(isAuthSyncLocaleIgnored("en")).toBe(false);
  });

  it("ignores stale incoming locale after manual change", () => {
    startManualLocaleChange("en");

    // Stale fetch arrives with old locale 'vi'
    expect(isAuthSyncLocaleIgnored("vi")).toBe(true);
    // Matching incoming locale 'en' is not ignored
    expect(isAuthSyncLocaleIgnored("en")).toBe(false);
  });

  it("handles out-of-order responses across rapid changes", () => {
    // User clicks 'en', then clicks 'vi'
    const rev1 = startManualLocaleChange("en");
    const rev2 = startManualLocaleChange("vi");

    expect(rev1).toBeLessThan(rev2);
    expect(isAuthSyncLocaleIgnored("en")).toBe(true); // 'en' is now stale
    expect(isAuthSyncLocaleIgnored("vi")).toBe(false); // 'vi' is current active target

    // Slow rev1 response arrives and confirms
    confirmManualLocaleSuccess(rev1, "en");

    // Active target should STILL be 'vi', rev1 should NOT override rev2
    expect(isAuthSyncLocaleIgnored("en")).toBe(true);
    expect(isAuthSyncLocaleIgnored("vi")).toBe(false);

    // rev2 response arrives and confirms
    confirmManualLocaleSuccess(rev2, "vi");
    expect(isAuthSyncLocaleIgnored("vi")).toBe(false);
    expect(isAuthSyncLocaleIgnored("en")).toBe(true);
  });

  it("handles rollback on mutation failure for latest action", () => {
    const rev1 = startManualLocaleChange("en");

    // rev1 fails, should rollback to 'vi'
    const rolledBack = rollbackManualLocaleChange(rev1, "vi");
    expect(rolledBack).toBe(true);

    // Active target rolled back to 'vi'
    expect(isAuthSyncLocaleIgnored("vi")).toBe(false);
    expect(isAuthSyncLocaleIgnored("en")).toBe(true);
  });

  it("does not rollback if a newer revision was triggered", () => {
    const rev1 = startManualLocaleChange("en");
    const rev2 = startManualLocaleChange("vi");

    // rev1 fails after rev2 was already initiated
    const rolledBackRev1 = rollbackManualLocaleChange(rev1, "vi");
    expect(rolledBackRev1).toBe(false); // Should not rollback because rev2 is active

    // Active target remains 'vi'
    expect(isAuthSyncLocaleIgnored("vi")).toBe(false);
    expect(isAuthSyncLocaleIgnored("en")).toBe(true);

    // If rev2 now fails, it should rollback to 'en'
    const rolledBackRev2 = rollbackManualLocaleChange(rev2, "en");
    expect(rolledBackRev2).toBe(true);
    expect(isAuthSyncLocaleIgnored("en")).toBe(false);
  });

  it("resets intent cleanly on user switch / logout", () => {
    startManualLocaleChange("en");
    resetManualLocaleIntent();

    expect(isAuthSyncLocaleIgnored("vi")).toBe(false);
  });

  it("ignores null or empty incoming locale", () => {
    expect(isAuthSyncLocaleIgnored(null)).toBe(true);
    expect(isAuthSyncLocaleIgnored(undefined)).toBe(true);
    expect(isAuthSyncLocaleIgnored("")).toBe(true);
  });
});
