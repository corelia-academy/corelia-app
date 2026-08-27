import type { SupabaseClient } from "../lib/supabase.ts";
import type { PaymentTransaction } from "./types.ts";

export async function grantPaymentAccessForTransaction(
  db: SupabaseClient,
  tx: PaymentTransaction,
  invoiceNumber: string,
  updatedAt: string,
  providerPayload: unknown,
): Promise<void> {
  const mergedPayload = (providerPayload ?? tx.provider_payload ?? {}) as Record<string, unknown>;
  const { data: rpcResult, error: rpcError } = await db.rpc("process_successful_payment", {
    p_payment_transaction_id: invoiceNumber,
    p_provider_payload: mergedPayload,
    p_settled_at: updatedAt,
  });

  if (rpcError) {
    throw new Error(rpcError.message);
  }

  if (!rpcResult || !(rpcResult as { ok?: boolean }).ok) {
    throw new Error("Atomic payment settlement returned an invalid result");
  }
}
