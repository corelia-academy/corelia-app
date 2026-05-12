import type { SupabaseClient } from "../lib/supabase.ts";
import type { AiSubscriptionMeta, PaymentTransaction } from "./types.ts";

export async function grantPaymentAccessForTransaction(
  db: SupabaseClient,
  tx: PaymentTransaction,
  invoiceNumber: string,
  updatedAt: string,
  providerPayload: unknown,
): Promise<void> {
  if (tx.purpose === "ai_subscription") {
    const meta = ((providerPayload as { subscription_meta?: AiSubscriptionMeta } | null)?.subscription_meta ??
      (tx.provider_payload as { subscription_meta?: AiSubscriptionMeta } | null)?.subscription_meta ??
      null) as AiSubscriptionMeta | null;
    if (!meta?.tier || !meta?.duration_months) {
      throw new Error("Missing ai subscription metadata");
    }

    const startedAt = updatedAt;
    const expiresDate = new Date(updatedAt);
    expiresDate.setMonth(expiresDate.getMonth() + Number(meta.duration_months));
    const expiresAt = expiresDate.toISOString();

    const { error: cancelExistingError } = await db
      .from("ai_subscriptions")
      .update({ status: "cancelled", updated_at: updatedAt })
      .eq("user_id", tx.user_id)
      .eq("status", "active");
    if (cancelExistingError) throw new Error(cancelExistingError.message);

    const { error: subscriptionError } = await db.from("ai_subscriptions").insert({
      user_id: tx.user_id,
      tier: meta.tier,
      duration_months: meta.duration_months,
      price_vnd: Math.round(Number(tx.amount_vnd ?? 0)),
      started_at: startedAt,
      expires_at: expiresAt,
      payment_transaction_id: invoiceNumber,
      status: "active",
      auto_renew: false,
      created_at: updatedAt,
      updated_at: updatedAt,
    });
    if (subscriptionError) throw new Error(subscriptionError.message);

    const { error: profileError } = await db
      .from("profiles")
      .update({ tier: meta.tier, updated_at: updatedAt })
      .eq("id", tx.user_id);
    if (profileError) throw new Error(profileError.message);

    const { error: txErr } = await db.from("payment_transactions").update({
      status: "paid",
      provider_payload: providerPayload as Record<string, unknown> | null,
      updated_at: updatedAt,
    }).eq("id", invoiceNumber);
    if (txErr) throw new Error(txErr.message);
    return;
  }

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
