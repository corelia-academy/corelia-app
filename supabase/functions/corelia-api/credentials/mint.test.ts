import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";
import { mintCredentialOnce } from "./mint.ts";

const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("../lib/mail/resend.ts", () => ({ sendTransactionalEmailViaResend: mail.send }));
vi.mock("./settings.ts", () => ({
  getDefaultMintNetwork: async () => "mainnet",
  getCoreliaLogoUrl: async () => "https://cdn.example.com/logo.png",
  getAppBaseUrl: async () => "https://app.corelia.academy",
  getMintEndpoint: async () => "https://api.vc.opencampus.xyz/issuer/vc",
  openCampusApiKey: () => "test-key",
}));

function makeDb(postMintFailed = false) {
  const issuance = {
    id: "issuance-1",
    template_id: "template-1",
    user_id: "dd58ad83-fb70-4c35-a6b6-d0cb88c00e07",
    course_id: "course-1",
    hackathon_id: null,
    issuer_reference_id: "ref-1",
    network: "mainnet",
    status: postMintFailed ? "failed" : "pending",
    retry_count: 1,
    oc_credential_id: postMintFailed ? "12345" : null,
    minted_at: postMintFailed ? "2026-09-25T08:00:00Z" : null,
    credential_templates: {
      id: "template-1",
      scope_type: "course",
      course_id: "course-1",
      hackathon_id: null,
      name: "UniHackfest 2026 Training Program",
      description: "Completed the course",
      image_url: "https://cdn.example.com/certificate.png",
      thumbnail_url: null,
      achievement_type: "CertificateOfCompletion",
      identifier_prefix: "corelia:unihackfest-2026",
      collection_symbol: null,
      custom_metadata: {},
      network_override: "mainnet",
      trigger_type: "course_completion",
    },
  };
  const notifications: Array<Record<string, unknown>> = [];
  const attempts: Array<Record<string, unknown>> = [];
  const db = {
    from(table: string) {
      if (table === "credential_issuances") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: issuance, error: null }) }) }),
        update: (values: Record<string, unknown>) => ({
          eq: async () => { Object.assign(issuance, values); return { error: null }; },
        }),
      };
      if (table === "profiles") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({
          data: { username: "terran", email: "terran@example.com", full_name: "Terran", ocid: "corelia.edu", ocid_eth_address: null },
          error: null,
        }) }) }),
      };
      if (table === "user_notifications") return {
        insert: async (values: Record<string, unknown>) => { notifications.push(values); return { error: null }; },
      };
      if (table === "credential_mint_attempts") return {
        insert: async (values: Record<string, unknown>) => { attempts.push(values); return { error: null }; },
      };
      throw new Error(`Unexpected table ${table}`);
    },
    auth: { admin: { getUserById: async () => ({ data: { user: { user_metadata: { locale: "en" } } } }) } },
  };
  return { db: db as unknown as SupabaseClient, issuance, notifications, attempts };
}

describe("mintCredentialOnce post-mint handling", () => {
  beforeEach(() => {
    mail.send.mockReset();
    mail.send.mockResolvedValue({ sent: true, providerMessageId: "mail-1" });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); vi.restoreAllMocks(); });

  it("keeps a successful mainnet mint minted and sends notices with the holder OCID", async () => {
    const { db, issuance, notifications, attempts } = makeDb();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ vc: { id: "urn:uuid:00000000-0000-0000-0000-000000003039" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await mintCredentialOnce(db, issuance.id)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(issuance.status).toBe("minted");
    expect(issuance.oc_credential_id).toBe("12345");
    expect(notifications).toHaveLength(1);
    expect(notifications[0].payload).toMatchObject({ holder_ocid: "corelia.edu", network: "mainnet", oc_credential_id: "12345" });
    expect(notifications[0].payload).toMatchObject({ issuance_id: issuance.id });
    expect(attempts).toMatchObject([{ issuance_id: issuance.id, outcome: "accepted" }]);
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0].context).toEqual({ type: "oc_issuance", id: issuance.id });
    expect(mail.send.mock.calls[0][0].html).toContain("id.opencampus.xyz");
  });

  it("reconciles an already minted row without posting to Open Campus again", async () => {
    const { db, issuance, notifications, attempts } = makeDb(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await mintCredentialOnce(db, issuance.id)).toEqual({ ok: true, duplicate: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(attempts).toHaveLength(0);
    expect(issuance.status).toBe("minted");
    expect(notifications).toHaveLength(1);
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it("does not turn a completed mint into a failed issuance when email fails", async () => {
    const { db, issuance, notifications } = makeDb(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    mail.send.mockRejectedValue(new Error("email unavailable"));
    vi.stubGlobal("fetch", vi.fn());

    expect(await mintCredentialOnce(db, issuance.id)).toEqual({ ok: true, duplicate: true });
    expect(issuance.status).toBe("minted");
    expect(notifications).toHaveLength(1);
  });
});
