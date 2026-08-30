import type { PaymentTransaction } from "@/lib/payments";

export type BillingPurposeTranslationKey =
  | "billing.purpose.coursePurchase"
  | "billing.purpose.certificateFee";

export type BillingMetadataTranslation = {
  key: "billing.meta.courseProviderOrder";
  values: { course: string; provider: string; order: string };
};

export function billingPurposeTranslationKey(
  purpose: PaymentTransaction["purpose"],
): BillingPurposeTranslationKey {
  if (purpose === "course_purchase") return "billing.purpose.coursePurchase";
  return "billing.purpose.certificateFee";
}

export function billingMetadataTranslation(
  transaction: Pick<PaymentTransaction, "id" | "course_id" | "provider" | "purpose">,
): BillingMetadataTranslation {
  return {
    key: "billing.meta.courseProviderOrder",
    values: {
      course: transaction.course_id,
      provider: transaction.provider,
      order: transaction.id,
    },
  };
}
