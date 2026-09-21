import { importSPKI, jwtVerify } from "npm:jose@5.9.6";

import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";

// Public ES256 keys shipped by @opencampus/ocid-connect-js 2.0.8.
const OCID_KEYS = {
  live: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEBIDHtLbgVM76SXZ4iuIjuO+ERQPnVpJzagOsZdYxFG3ZJmvfdpr/Z29SLUbdZWafrOlAVlKe1Ovf/tcH671tTw==",
  sandbox: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/EymMLXd/MVYPK5r2xXQj91ZVvX3OQ+QagvR2N6lCvRVjnzmOtPRTf+u5g1RliWnmuxbV3gTm0/0VuV/40Salg==",
};

export async function handleOcidLink(req: Request, db: SupabaseClient): Promise<Response> {
  let user;
  try { user = await verifyBearerUser(req, db); } catch { return json({ message: "unauthenticated" }, 401); }
  const clientId = Deno.env.get("OCID_CLIENT_ID")?.trim();
  if (!clientId) return json({ message: "ocid_verification_unconfigured" }, 503);
  const body = await req.json().catch(() => null) as { idToken?: unknown } | null;
  if (typeof body?.idToken !== "string" || body.idToken.length > 10_000) return json({ message: "invalid_ocid_token" }, 400);
  try {
    const key = OCID_KEYS[Deno.env.get("OCID_SANDBOX") === "true" ? "sandbox" : "live"];
    const publicKey = await importSPKI(`-----BEGIN PUBLIC KEY-----\n${key}\n-----END PUBLIC KEY-----`, "ES256");
    const { payload } = await jwtVerify(body.idToken, publicKey, { algorithms: ["ES256"], audience: clientId, requiredClaims: ["exp", "iat"] });
    const ocid = payload.edu_username;
    const ethAddress = payload.eth_address;
    if (typeof ocid !== "string" || !ocid.trim()) return json({ message: "invalid_ocid_token" }, 400);
    const { data: awarded, error } = await db.rpc("xp_link_verified_ocid", {
      p_user_id: user.id, p_ocid: ocid, p_eth_address: typeof ethAddress === "string" ? ethAddress : null,
    });
    if (error) {
      if (error.code === "23505") return json({ message: "OCID_ALREADY_LINKED" }, 409);
      return json({ message: "ocid_link_failed" }, 500);
    }
    return json({ linked: true, awarded: Boolean(awarded) });
  } catch {
    return json({ message: "invalid_ocid_token" }, 400);
  }
}
