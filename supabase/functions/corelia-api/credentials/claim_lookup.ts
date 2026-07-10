import { json } from "../lib/http.ts";
import type { SupabaseClient } from "../lib/supabase.ts";

/** Public (no auth) — lists pending ghost-minted credentials for an email, for the
 *  /claim landing page. Deliberately returns only display fields (name/image/kind),
 *  never granted_reason/granted_by, since anyone who knows the email can call this. */
export async function handleClaimLookup(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return json({ ok: false, message: "Email không hợp lệ" }, 400);
    }

    const { data, error } = await db
      .from("pending_credential_issuances")
      .select("id, created_at, credential_templates (name, image_url, thumbnail_url, collection_symbol)")
      .ilike("email", email)
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

    return json({ ok: true, items });
  } catch (e) {
    console.error("[corelia-api] credentials.claimLookup", e);
    return json({ ok: false, message: "internal_error" }, 500);
  }
}
