import type { SupabaseClient } from "../lib/supabase.ts";
import type { PaymentTransaction } from "./types.ts";

export async function grantPaymentAccessForTransaction(
  db: SupabaseClient,
  tx: PaymentTransaction,
  invoiceNumber: string,
  updatedAt: string,
  providerPayload: unknown,
): Promise<void> {
  const accessId = `${tx.user_id}_${tx.course_id}`;
  const { data: existingAccess, error: existingAccessErr } = await db
    .from("course_payment_access")
    .select("full_access_granted, certificate_fee_paid")
    .eq("id", accessId)
    .maybeSingle();
  if (existingAccessErr) throw new Error(existingAccessErr.message);
  const fullAccess = tx.purpose === "course_purchase"
    ? true
    : existingAccess?.full_access_granted === true;
  const certPaid = tx.purpose === "certificate_fee"
    ? true
    : existingAccess?.certificate_fee_paid === true;
  const accessPatch = {
    id: accessId,
    user_id: tx.user_id,
    course_id: tx.course_id,
    updated_at: updatedAt,
    full_access_granted: fullAccess,
    certificate_fee_paid: certPaid,
  };
  const { error: accessErr } = await db.from("course_payment_access").upsert(accessPatch, {
    onConflict: "user_id,course_id",
  });
  if (accessErr) throw new Error(accessErr.message);
  if (tx.purpose === "course_purchase") {
    const enrollmentId = `${tx.user_id}_${tx.course_id}`;
    const enrPayload = {
      id: enrollmentId,
      user_id: tx.user_id,
      course_id: tx.course_id,
      enrolled_at: updatedAt,
      last_accessed_at: updatedAt,
      paid_provider: "sepay",
      paid_amount_vnd: Math.round(Number(tx.amount_vnd ?? 0)),
      paid_order_id: invoiceNumber,
      paid_at: updatedAt,
    };
    const { error: enrErr } = await db.from("enrollments").upsert(enrPayload, {
      onConflict: "user_id,course_id",
    });
    if (enrErr) throw new Error(enrErr.message);
  }
  const { error: txErr } = await db.from("payment_transactions").update({
    status: "paid",
    provider_payload: providerPayload as Record<string, unknown> | null,
    updated_at: updatedAt,
  }).eq("id", invoiceNumber);
  if (txErr) throw new Error(txErr.message);
}
