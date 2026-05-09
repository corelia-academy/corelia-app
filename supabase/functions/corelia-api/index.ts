/**
 * Corelia API — Supabase Edge Function (Deno).
 * Invoke: GET/POST {SUPABASE_URL}/functions/v1/corelia-api?op=<operation>
 *
 * Operations: health | payments.sepay.checkout | payments.transactions |
 *   payments.sepay.verify | payments.sepay.ipn | certificates.issue |
 *   hackathons.notifyRegistrationReview
 */
import { handleIssueCertificate } from "./certificates/handlers.ts";
import { handleHackathonNotifyRegistrationReview } from "./hackathons/handlers.ts";
import { cors, json } from "./lib/http.ts";
import { createServiceClient, type SupabaseClient } from "./lib/supabase.ts";
import {
  handleMyPaymentTransactions,
  handleSePayCheckout,
  handleSePayIpn,
  handleVerifySePayPayment,
} from "./payments/handlers.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  const url = new URL(req.url);
  const op = url.searchParams.get("op") ?? "";
  let db: SupabaseClient;
  try {
    db = createServiceClient();
  } catch (e) {
    console.error("[corelia-api] boot", e);
    return json({ message: "Server misconfiguration" }, 500);
  }
  if (op === "health" && req.method === "GET") return json({ ok: true });
  if (op === "payments.sepay.checkout" && req.method === "POST") {
    return await handleSePayCheckout(req, db);
  }
  if (op === "payments.transactions" && req.method === "GET") {
    return await handleMyPaymentTransactions(req, db);
  }
  if (op === "certificates.issue" && req.method === "POST") {
    return await handleIssueCertificate(req, db);
  }
  if (op === "payments.sepay.verify" && req.method === "POST") {
    return await handleVerifySePayPayment(req, db);
  }
  if (op === "payments.sepay.ipn" && req.method === "POST") {
    return await handleSePayIpn(req, db);
  }
  if (op === "hackathons.notifyRegistrationReview" && req.method === "POST") {
    return await handleHackathonNotifyRegistrationReview(req, db);
  }
  return json({ message: "Unknown or disallowed op / method", op }, 404);
});
