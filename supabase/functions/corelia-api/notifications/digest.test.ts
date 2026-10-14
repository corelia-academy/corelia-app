import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";
const mocks = vi.hoisted(() => ({ claim: vi.fn(), success: vi.fn(), failure: vi.fn(), send: vi.fn(), dispatch: vi.fn() }));
vi.mock("../lib/mail/outbox.ts", () => ({ claimOutboxLease: mocks.claim, commitOutboxSuccess: mocks.success, commitOutboxFailure: mocks.failure, persistOutboxDispatch: mocks.dispatch, releaseOutboxUnconfigured: vi.fn() }));
vi.mock("../lib/mail/resend.ts", () => ({ isTransactionalEmailConfigured: () => true, sendTransactionalEmailViaResend: mocks.send }));
import { buildDigest, digestStillVisible, sendSocialDigests, type DigestItem } from "./digest.ts";
const item: DigestItem = { key: "notification:1:today", type: "project_liked", payload: { title: "Test <script>", count: 2, target_path: "/projects/test" } };
function database(contents: DigestItem[][], existing?: Record<string, unknown>) {
  const finish = vi.fn(); let reads = 0;
  return { finish, db: {
    rpc: vi.fn(async (op: string, args: unknown) => {
      if (op === "notification_digest_candidates") return { data: [{ user_id: "u", email: "a@example.test", locale: "en", unsubscribe_token: "token", digest_key: "social-digest/u/original-day" }], error: null };
      if (op === "notification_digest_content") return { data: contents[Math.min(reads++, contents.length - 1)], error: null };
      finish(args); return { error: null };
    }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing ?? null, error: null }) }) }), upsert: async () => ({ error: null }) }),
  } as unknown as SupabaseClient };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("Deno", { env: { get: (key: string) => ({ MAIL_FROM: "Corelia <noreply@example.test>", CORELIA_APP_ORIGIN: "https://example.test", SUPABASE_URL: "https://database.example.test" })[key] } });
  mocks.claim.mockImplementation(async (args) => ({ type: "claimed", leaseToken: "lease", event: { request_payload: args.buildSnapshot(), first_dispatched_at: null } }));
  mocks.dispatch.mockResolvedValue({ ok: true }); mocks.success.mockResolvedValue(true);
  mocks.send.mockResolvedValue({ sent: true, providerMessageId: "provider-id" });
});
describe("daily social digest", () => {
  it("escapes content and rejects external or protocol-relative destinations", () => {
    const mail = buildDigest([{ ...item, payload: { ...item.payload, target_path: "//attacker.test" } }], "en", "https://example.test", "https://example.test/unsubscribe");
    expect(mail.html).toContain("&lt;script&gt;"); expect(mail.html).not.toContain("attacker.test");
    expect(mail.html).toContain("Unsubscribe");
    expect(buildDigest([item], "vi", "https://example.test", "https://example.test/unsubscribe").html).toContain("đã thích");
  });
  it("does not send empty email", async () => {
    const { db } = database([[]]); await sendSocialDigests(db);
    expect(mocks.claim).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rechecks opt-out and visibility after lease acquisition", async () => {
    const { db } = database([[item], []]); await sendSocialDigests(db);
    expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.failure).toHaveBeenCalledWith(expect.objectContaining({ isPermanent: true }));
    expect(digestStillVisible([item], [{ ...item, payload: {} }])).toBe(false);
  });
  it("consumes the frozen keys only after accepted delivery is persisted", async () => {
    const { db, finish } = database([[item]]); expect((await sendSocialDigests(db)).accepted).toBe(1);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "social-digest/u/original-day" }));
    expect(finish).toHaveBeenCalledWith({ p_user: "u", p_keys: [item.key], p_accepted: true });
  });
  it("recovers a failed finish without sending an accepted email again", async () => {
    const { db, finish } = database([[]], { status: "accepted", request_payload: { notification_items: [item] } });
    await sendSocialDigests(db); expect(mocks.send).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledWith(expect.objectContaining({ p_keys: [item.key], p_accepted: true }));
  });
  it("retains the retry key and does not mark an ambiguous send as accepted", async () => {
    mocks.send.mockResolvedValue({ sent: false, providerError: "timeout", isRetryable: true, isConfigError: false });
    const { db, finish } = database([[item]]); expect((await sendSocialDigests(db)).failed).toBe(1);
    expect(mocks.failure).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "social-digest/u/original-day", isPermanent: false }));
    expect(finish).toHaveBeenCalledWith(expect.objectContaining({ p_accepted: false }));
  });
});
