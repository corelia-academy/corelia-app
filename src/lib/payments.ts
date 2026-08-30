import { coreliaEdgeUrl, supabaseFunctionHeaders } from "@/lib/coreliaEdgeApi";
import { supabase } from "@/lib/supabase";
import { makeTTLCache } from "@/lib/utils";

const paymentAccessCache = makeTTLCache<CoursePaymentAccess | null>(60_000);

export type PaymentPurpose = "course_purchase" | "certificate_fee";

export type CoursePaymentAccessSource =
  | "payment"
  | "admin_grant"
  | "voucher"
  | "free_enrollment"
  | "legacy";

export type CoursePaymentAccessStatus = "active" | "revoked" | "expired";

export interface CoursePaymentAccess {
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
}

export interface CourseEntitlementGrant {
  id: string;
  user_id: string;
  course_id: string;
  source: CoursePaymentAccessSource;
  status: CoursePaymentAccessStatus;
  source_transaction_id?: string | null;
  granted_by?: string | null;
  reason?: string | null;
  granted_at: string;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingProduct {
  id: string;
  product_type: string;
  title: string;
  description?: string | null;
  active: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransactionItem {
  id: string;
  payment_transaction_id: string;
  product_id: string;
  resource_id: string;
  unit_price_vnd: number;
  quantity: number;
  snapshot: Record<string, unknown>;
  fulfillment_status: "pending" | "fulfilled" | "conflict" | "failed" | "revoked";
  fulfillment_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentTransactionStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refund_requested"
  | "refunded"
  | "partially_refunded";

export type PaymentRefundStatus =
  | "requested"
  | "approved"
  | "processing"
  | "completed"
  | "rejected"
  | "failed"
  | "cancelled";

export interface PaymentRefund {
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
}

export type PaymentProvider = "sepay";
export interface PaymentTransaction {
  id: string;
  user_id: string;
  course_id: string;
  purpose: PaymentPurpose;
  amount_vnd: number;
  original_amount_vnd?: number | null;
  discount_code?: string | null;
  discount_amount_vnd?: number | null;
  provider: PaymentProvider;
  status: PaymentTransactionStatus;
  created_at: string;
  updated_at: string;
}

export interface VerifySePayPaymentResponse {
  order_id: string;
  status: PaymentTransactionStatus;
  purpose: PaymentPurpose;
  course_id: string;
  full_access_granted: boolean;
  certificate_fee_paid: boolean;
  enrolled: boolean;
  verified_by: "transaction" | "sepay_lookup" | "pending";
}

interface CreateSePayCheckoutInput {
  courseId: string;
  purpose: PaymentPurpose;
  amountVnd: number;
  successUrl: string;
  errorUrl: string;
  cancelUrl: string;
  discountCode?: string;
}

export interface CreateSePayCheckoutResponse {
  checkout_url?: string;
  order_id: string;
  fields?: Record<string, string>;
  free_checkout?: boolean;
  success_url?: string;
}

export async function getCoursePaymentAccess(
  userId: string,
  courseId: string,
): Promise<CoursePaymentAccess | null> {
  const key = `${userId}_${courseId}`;
  const cached = paymentAccessCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("course_payment_access")
      .select("*")
      .eq("id", key)
      .maybeSingle();
    if (error || !data) return null;
    return { id: data.id, ...data } as CoursePaymentAccess;
  })();
  paymentAccessCache.set(key, promise);
  promise.catch(() => paymentAccessCache.delete(key));
  return promise;
}

export function invalidatePaymentAccessCache(userId: string, courseId: string) {
  paymentAccessCache.delete(`${userId}_${courseId}`);
}

async function getAccessToken(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch (err) {
    console.error("[payments] getSession failed:", err);
    return null;
  }
}

const INVALID_SESSION_MESSAGE = "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";

function requireAccessToken(token: string | null): asserts token is string {
  if (!token) throw new Error(INVALID_SESSION_MESSAGE);
}

export async function createSePayCheckout(
  payload: CreateSePayCheckoutInput,
): Promise<CreateSePayCheckoutResponse> {
  const endpoint =
    import.meta.env.VITE_SEPAY_CHECKOUT_API ||
    coreliaEdgeUrl("payments.sepay.checkout");

  const token = await getAccessToken();
  requireAccessToken(token);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...supabaseFunctionHeaders(token),
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<
    CreateSePayCheckoutResponse & { message?: string }
  >;
  if (!res.ok || !data.order_id) {
    throw new Error(data.message || "Không tạo được phiên thanh toán SePay.");
  }
  if (data.free_checkout) {
    if (!data.success_url) {
      throw new Error(data.message || "Không tạo được phiên thanh toán SePay.");
    }
    return {
      order_id: data.order_id,
      free_checkout: true,
      success_url: data.success_url,
    };
  }
  if (!data.checkout_url || !data.fields) {
    throw new Error(data.message || "Không tạo được phiên thanh toán SePay.");
  }
  return {
    checkout_url: data.checkout_url,
    order_id: data.order_id,
    fields: data.fields,
  };
}

export function submitSePayCheckoutForm(input: CreateSePayCheckoutResponse) {
  if (!input.checkout_url || !input.fields) {
    throw new Error("Thiếu thông tin checkout SePay.");
  }
  const form = document.createElement("form");
  form.method = "POST";
  form.action = input.checkout_url;

  for (const [key, value] of Object.entries(input.fields)) {
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = key;
    field.value = String(value ?? "");
    form.appendChild(field);
  }

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

export function completeSePayCheckout(input: CreateSePayCheckoutResponse) {
  if (input.free_checkout && input.success_url) {
    window.location.assign(input.success_url);
    return;
  }
  submitSePayCheckoutForm(input);
}

export async function getMyPaymentTransactions(): Promise<PaymentTransaction[]> {
  const endpoint =
    import.meta.env.VITE_SEPAY_TRANSACTIONS_API ||
    coreliaEdgeUrl("payments.transactions");
  const token = await getAccessToken();
  requireAccessToken(token);
  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      ...supabaseFunctionHeaders(token),
    },
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as Partial<{
    transactions: PaymentTransaction[];
    message?: string;
  }>;
  if (!res.ok) throw new Error(data.message || "Không lấy được lịch sử thanh toán.");
  return Array.isArray(data.transactions) ? data.transactions : [];
}

export async function verifySePayPayment(payload: {
  orderId?: string;
  courseId?: string;
  purpose?: PaymentPurpose;
  /** When set, skips internal `getSession()` (avoids hammering auth during polling). */
  accessToken?: string;
}): Promise<VerifySePayPaymentResponse> {
  const endpoint =
    import.meta.env.VITE_SEPAY_VERIFY_API || coreliaEdgeUrl("payments.sepay.verify");
  const { accessToken: accessTokenOverride, ...verifyBody } = payload;
  const token =
    accessTokenOverride !== undefined ? accessTokenOverride : await getAccessToken();
  requireAccessToken(token);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...supabaseFunctionHeaders(token),
    },
    credentials: "include",
    body: JSON.stringify(verifyBody),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<
    VerifySePayPaymentResponse & { message?: string }
  >;
  if (!res.ok || !data.order_id || !data.status || !data.course_id || !data.purpose) {
    throw new Error(data.message || "Không thể xác minh thanh toán.");
  }

  return {
    order_id: data.order_id,
    status: data.status,
    purpose: data.purpose,
    course_id: data.course_id,
    full_access_granted: data.full_access_granted === true,
    certificate_fee_paid: data.certificate_fee_paid === true,
    enrolled: data.enrolled === true,
    verified_by: data.verified_by ?? "pending",
  };
}
