export type PaymentPurpose = "course_purchase" | "certificate_fee" | "ai_subscription";

export type AiSubscriptionTier = "student" | "pro" | "bootcamp";
export type AiSubscriptionDurationMonths = 1 | 12;

export type AiSubscriptionMeta = {
  tier: AiSubscriptionTier;
  duration_months: AiSubscriptionDurationMonths;
};

export type PaymentTransactionStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refund_requested"
  | "refunded"
  | "partially_refunded";

export type PaymentTransaction = {
  user_id: string;
  course_id: string;
  purpose: PaymentPurpose;
  amount_vnd: number;
  original_amount_vnd?: number | null;
  discount_code?: string | null;
  discount_amount_vnd?: number | null;
  provider: "sepay";
  status: PaymentTransactionStatus;
  provider_payload?: unknown;
  created_at: string;
  updated_at: string;
};

export type PaymentRefundStatus =
  | "requested"
  | "approved"
  | "processing"
  | "completed"
  | "rejected"
  | "failed"
  | "cancelled";

export type PaymentRefund = {
  id: string;
  payment_transaction_id: string;
  user_id: string;
  amount_vnd: number;
  status: PaymentRefundStatus;
  reason: string;
  requested_by?: string | null;
  processed_by?: string | null;
  provider_refund_id?: string | null;
  provider_payload?: unknown;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
};

export type CoursePaymentAccessSource =
  | "payment"
  | "admin_grant"
  | "voucher"
  | "free_enrollment"
  | "legacy";

export type CoursePaymentAccessStatus = "active" | "revoked" | "expired";

export type CoursePaymentAccess = {
  id: string;
  user_id: string;
  course_id: string;
  full_access_granted?: boolean;
  certificate_fee_paid?: boolean;
  source?: CoursePaymentAccessSource;
  status?: CoursePaymentAccessStatus;
  source_transaction_id?: string | null;
  granted_at?: string;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  granted_by?: string | null;
  updated_at?: string;
};

export type SePayIpnPayload = {
  notification_type?: string;
  order?: { order_invoice_number?: string; order_amount?: string };
};

export type SePayTransactionListItem = {
  id?: string;
  transaction_date?: string;
  amount_in?: number | string;
  amount_out?: number | string;
  transaction_content?: string;
  reference_number?: string;
  code?: string;
  transfer_type?: string;
  bank_account_id?: string;
};
