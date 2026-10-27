import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";
import { sha256Hex } from "../lib/crypto.ts";

const mocks = vi.hoisted(() => ({ send: vi.fn(), rateLimit: vi.fn() }));
vi.mock("../lib/supabase.ts", () => ({ verifyBearerUser: async () => ({ id: "inviter" }) }));
vi.mock("../lib/mail/resend.ts", () => ({ sendTransactionalEmailViaResend: mocks.send }));
vi.mock("../lib/rate_limit.ts", () => ({ consumeRateLimit: mocks.rateLimit }));
vi.mock("../lib/mail/layout.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/mail/layout.ts")>()),
  resolveAppUrl: () => "https://app.test/learn",
}));

import { handleCoInstructorInviteEmail } from "./co_instructor_invite_email.ts";

const token = "a".repeat(64);
const inviteId = "33333333-3333-4333-8333-333333333333";

async function dbFor(tokenHash: string) {
  const rows: Record<string, unknown> = {
    course_co_instructor_invites: {
      id: inviteId, course_id: "course-1", invitee_user_id: "invitee", invited_by: "inviter",
      permissions: { edit_content: true }, status: "pending",
      expires_at: new Date(Date.now() + 86_400_000).toISOString(), token_hash: tokenHash,
    },
    profiles: { email: "invitee@example.com", full_name: "Inviter", locale: "en" },
    courses: { data: { title: "Course" } },
  };
  return {
    from: (table: string) => {
      const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: rows[table] ?? null, error: null }) };
      return chain;
    },
  } as unknown as SupabaseClient;
}

const request = (body: Record<string, unknown>) => new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ sent: true });
  mocks.rateLimit.mockResolvedValue(undefined);
});

describe("co-instructor invite email", () => {
  it("emails the link when the token matches the invite", async () => {
    const response = await handleCoInstructorInviteEmail(request({ invite_id: inviteId, token }), await dbFor(await sha256Hex(token)));
    expect(response.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      to: ["invitee@example.com"],
      idempotencyKey: `course-co-instructor-invite:${inviteId}`,
    }));
    expect(String(mocks.send.mock.calls[0]![0].html)).toContain(`/invites/co-instructor/${token}`);
  });

  it("rejects a token that does not belong to the invite before spending quota or sending", async () => {
    const response = await handleCoInstructorInviteEmail(request({ invite_id: inviteId, token: "b".repeat(64) }), await dbFor(await sha256Hex(token)));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "invalid_input:token_mismatch" });
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
