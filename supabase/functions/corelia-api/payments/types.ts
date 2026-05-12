export type PaymentPurpose = "course_purchase" | "certificate_fee";

export type PaymentTransaction = {
  user_id: string;
  course_id: string;
  purpose: PaymentPurpose;
  amount_vnd: number;
  original_amount_vnd?: number | null;
  discount_code?: string | null;
  discount_amount_vnd?: number | null;
  provider: "sepay";
  status: "pending" | "paid" | "failed" | "cancelled";
  provider_payload?: unknown;
  created_at: string;
  updated_at: string;
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
