import type { SupabaseClient } from "../lib/supabase.ts";
import type { AiSubscriptionMeta, PaymentTransaction } from "./types.ts";
import { markVoucherPaidForPayment } from "./vouchers.ts";

export async function grantPaymentAccessForTransaction(
  db: SupabaseClient,
  tx: PaymentTransaction,
  invoiceNumber: string,
  updatedAt: string,
  providerPayload: unknown,
): Promise<void> {
  const mergedPayload = (providerPayload ?? tx.provider_payload ?? {}) as Record<string, unknown>;

  // Attempt atomic database settlement RPC
  const { data: rpcResult, error: rpcError } = await db.rpc("process_successful_payment", {
    p_payment_transaction_id: invoiceNumber,
    p_provider_payload: mergedPayload,
    p_settled_at: updatedAt,
  });

  if (!rpcError && rpcResult && (rpcResult as { ok?: boolean }).ok) {
    return;
  }

  // Fallback path for environments before RPC deployment or compatibility mode
  if (tx.purpose === "ai_subscription") {
    const meta = ((mergedPayload as { subscription_meta?: AiSubscriptionMeta } | null)?.subscription_meta ??
      null) as AiSubscriptionMeta | null;
    if (!meta?.tier || !meta?.duration_months) {
      throw new Error("Missing ai subscription metadata");
    }

    const { data: currentActive, error: currentActiveError } = await db
      .from("ai_subscriptions")
      .select("id,tier,expires_at,status")
      .eq("user_id", tx.user_id)
      .eq("status", "active")
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; tier: string; expires_at: string; status: "active" }>();
    if (currentActiveError) throw new Error(currentActiveError.message);
    const TIER_RANK = { student: 1, pro: 2, bootcamp: 3 } as const;
    const isUpgrade = currentActive?.tier && meta.tier !== currentActive.tier
      && (TIER_RANK[meta.tier as keyof typeof TIER_RANK] ?? 0) > (TIER_RANK[currentActive.tier as keyof typeof TIER_RANK] ?? 0);

    if (currentActive?.tier && meta.tier !== currentActive.tier && !isUpgrade) {
      throw new Error("Downgrade not allowed on active subscription");
    }

    // Upgrade → start immediately. Same-tier renewal → extend from existing expiry.
    const startBase = (!isUpgrade && currentActive?.expires_at && Date.parse(currentActive.expires_at) > Date.parse(updatedAt))
      ? currentActive.expires_at
      : updatedAt;
    const startedAt = startBase;
    const expiresDate = new Date(startBase);
    expiresDate.setMonth(expiresDate.getMonth() + Number(meta.duration_months));
    const expiresAt = expiresDate.toISOString();

    if (currentActive?.id) {
      const { error: supersedeExistingError } = await db
        .from("ai_subscriptions")
        .update({ status: "superseded", updated_at: updatedAt })
        .eq("id", currentActive.id);
      if (supersedeExistingError) throw new Error(supersedeExistingError.message);
    }

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
    await markVoucherPaidForPayment(db, invoiceNumber, updatedAt);
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
    source: "payment",
    status: "active",
    source_transaction_id: invoiceNumber,
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
  await markVoucherPaidForPayment(db, invoiceNumber, updatedAt);
}
