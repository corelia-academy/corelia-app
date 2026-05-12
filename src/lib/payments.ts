import { coreliaEdgeUrl, supabaseFunctionHeaders } from "@/lib/coreliaEdgeApi";
import { supabase } from "@/lib/supabase";
import { makeTTLCache } from "@/lib/utils";

const paymentAccessCache = makeTTLCache<CoursePaymentAccess | null>(60_000);

export type PaymentPurpose = "course_purchase" | "certificate_fee" | "ai_subscription";
export type AiSubscriptionTier = "student" | "pro" | "bootcamp";
export type AiSubscriptionDurationMonths = 1 | 6 | 12;

export interface CoursePaymentAccess {
  id: string;
  user_id: string;
  course_id: string;
  full_access_granted?: boolean;
  certificate_fee_paid?: boolean;
  updated_at?: string;
}

export type PaymentTransactionStatus = "pending" | "paid" | "failed" | "cancelled";
export type PaymentProvider = "sepay";
export interface PaymentTransaction {
  id: string;
  user_id: string;
  course_id: string;
  purpose: PaymentPurpose;
  amount_vnd: number;
  provider: PaymentProvider;
  status: PaymentTransactionStatus;
  created_at: string;
  updated_at: string;
}

export interface AiSubscription {
  id: string;
  user_id: string;
  tier: AiSubscriptionTier;
  duration_months: AiSubscriptionDurationMonths;
  price_vnd: number;
  started_at: string;
  expires_at: string;
  payment_transaction_id: string;
  status: "active" | "expired" | "cancelled";
  auto_renew?: boolean;
  created_at: string;
  updated_at?: string;
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

interface CreateAiSubscriptionCheckoutInput {
  tier: AiSubscriptionTier;
  durationMonths: AiSubscriptionDurationMonths;
  successUrl: string;
  errorUrl: string;
  cancelUrl: string;
}

interface CreateSePayCheckoutResponse {
  checkout_url: string;
  order_id: string;
  fields: Record<string, string>;
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
  if (!res.ok || !data.checkout_url || !data.order_id || !data.fields) {
    throw new Error(data.message || "Không tạo được phiên thanh toán SePay.");
  }
  return {
    checkout_url: data.checkout_url,
    order_id: data.order_id,
    fields: data.fields,
  };
}

export async function createAiSubscriptionCheckout(
  payload: CreateAiSubscriptionCheckoutInput,
): Promise<CreateSePayCheckoutResponse> {
  return createSePayCheckout({
    courseId: "cora-ai",
    purpose: "ai_subscription",
    amountVnd: 1,
    successUrl: payload.successUrl,
    errorUrl: payload.errorUrl,
    cancelUrl: payload.cancelUrl,
    tier: payload.tier,
    durationMonths: payload.durationMonths,
  } as CreateSePayCheckoutInput & {
    tier: AiSubscriptionTier;
    durationMonths: AiSubscriptionDurationMonths;
  });
}

export function submitSePayCheckoutForm(input: CreateSePayCheckoutResponse) {
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

export async function getMyAiSubscription(): Promise<AiSubscription | null> {
  const token = await getAccessToken();
  requireAccessToken(token);
  const { data, error } = await supabase
    .from("ai_subscriptions")
    .select("*")
    .eq("status", "active")
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? ({ ...data } as AiSubscription) : null;
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
