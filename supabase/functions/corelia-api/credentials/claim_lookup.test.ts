import { describe, expect, it, vi } from "vitest";
import { handleClaimLookup } from "./claim_lookup.ts";
import type { SupabaseClient } from "../lib/supabase.ts";

const token = "123e4567-e89b-42d3-a456-426614174000";

function request(body: Record<string, unknown>) {
  return new Request("https://example.test/functions/v1/corelia-api?op=credentials.claimLookup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("public credential claim lookup", () => {
  it("rejects email patterns without querying the database", async () => {
    const from = vi.fn();
    const response = await handleClaimLookup(request({ email: "%@%" }), { from } as unknown as SupabaseClient);

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("keeps old email links usable without revealing pending credentials", async () => {
    const from = vi.fn();
    const response = await handleClaimLookup(request({ email: "recipient@example.test" }), { from } as unknown as SupabaseClient);

    expect(response.status).toBe(200);
    expect(from).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      ok: true,
      items: [{ name: "Chứng nhận đang chờ", imageUrl: null, isOCA: false }],
    });
  });

  it("uses an emailed issuance ID before fetching exact-email credentials", async () => {
    const email = "recipient_1@example.test";
    const claim = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { email }, error: null }),
    };
    const list = {
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ credential_templates: { name: "Badge", image_url: "image", thumbnail_url: null, collection_symbol: "OCB" } }],
        error: null,
      }),
    };
    const from = vi.fn().mockReturnValueOnce(claim).mockReturnValueOnce(list);
    const response = await handleClaimLookup(request({ token }), { from } as unknown as SupabaseClient);

    expect(response.status).toBe(200);
    expect(claim.eq).toHaveBeenCalledWith("id", token);
    expect(list.ilike).toHaveBeenCalledWith("email", "recipient\\_1@example.test");
    expect(await response.json()).toEqual({ ok: true, email, items: [{ name: "Badge", imageUrl: "image", isOCA: false }] });
  });

  it("returns no credential details for an unknown issuance ID", async () => {
    const claim = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const from = vi.fn().mockReturnValue(claim);
    const response = await handleClaimLookup(request({ token }), { from } as unknown as SupabaseClient);

    expect(from).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({ ok: true, items: [] });
  });
});
