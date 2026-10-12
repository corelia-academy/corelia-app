import { json } from "../lib/http.ts";
import type { SupabaseClient } from "../lib/supabase.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public (no auth) — the random pending issuance ID in the emailed link proves
 *  possession of that link. Never look up credentials by a caller-supplied email. */
export async function handleClaimLookup(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    // Older /claim pages still send email. Give them a generic card and signup
    // link without querying pending rows or revealing whether the email exists.
    if (!token && typeof body.email === "string") {
      const email = body.email.trim();
      if (email.includes("@") && !email.includes("%")) {
        return json({ ok: true, items: [{ name: "Chứng nhận đang chờ", imageUrl: null, isOCA: false }] });
      }
    }
    if (!UUID.test(token)) return json({ ok: false, message: "invalid_claim_link" }, 400);

    const { data: claim, error: claimError } = await db.from("pending_credential_issuances")
      .select("email").eq("id", token).maybeSingle();
    if (claimError) throw claimError;
    if (!claim) return json({ ok: true, items: [] });

    const { data, error } = await db
      .from("pending_credential_issuances")
      .select("credential_templates (name, image_url, thumbnail_url, collection_symbol)")
      .ilike("email", claim.email.replace(/[\\%_]/g, "\\$&"))
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[corelia-api] credentials.claimLookup db error", error);
      return json({ ok: false, message: "Không thể tra cứu." }, 500);
    }

    const items = (data ?? []).map((row) => {
      const raw = row as unknown as {
        credential_templates:
          | { name: string; image_url: string; thumbnail_url: string | null; collection_symbol: string | null }
          | { name: string; image_url: string; thumbnail_url: string | null; collection_symbol: string | null }[]
          | null;
      };
      const tpl = Array.isArray(raw.credential_templates)
        ? raw.credential_templates[0] ?? null
        : raw.credential_templates;
      return {
        name: tpl?.name ?? "",
        imageUrl: tpl?.thumbnail_url?.trim() || tpl?.image_url || null,
        isOCA: !tpl?.collection_symbol,
      };
    });

    return json({ ok: true, email: claim.email, items });
  } catch (e) {
    console.error("[corelia-api] credentials.claimLookup", e);
    return json({ ok: false, message: "internal_error" }, 500);
  }
}
