import type { PaymentTransaction } from "@/lib/payments";

export type BillingPurposeTranslationKey =
  | "billing.purpose.coursePurchase"
  | "billing.purpose.certificateFee"
  | "billing.purpose.historicalAiTransaction";

export type BillingMetadataTranslation =
  | {
      key: "billing.meta.courseProviderOrder";
      values: { course: string; provider: string; order: string };
    }
  | {
      key: "billing.meta.historicalAiProviderOrder";
      values: { provider: string; order: string };
    };

export function billingPurposeTranslationKey(
  purpose: PaymentTransaction["purpose"],
): BillingPurposeTranslationKey {
  if (purpose === "course_purchase") return "billing.purpose.coursePurchase";
  if (purpose === "ai_subscription") return "billing.purpose.historicalAiTransaction";
  return "billing.purpose.certificateFee";
}

export function billingMetadataTranslation(
  transaction: Pick<PaymentTransaction, "id" | "course_id" | "provider" | "purpose">,
): BillingMetadataTranslation {
  if (transaction.purpose === "ai_subscription") {
    return {
      key: "billing.meta.historicalAiProviderOrder",
      values: {
        provider: transaction.provider,
        order: transaction.id,
      },
    };
  }

  return {
    key: "billing.meta.courseProviderOrder",
    values: {
      course: transaction.course_id,
      provider: transaction.provider,
      order: transaction.id,
    },
  };
}
