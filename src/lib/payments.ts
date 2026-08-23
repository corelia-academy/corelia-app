import { coreliaEdgeUrl, supabaseFunctionHeaders } from "@/lib/coreliaEdgeApi";
import { supabase } from "@/lib/supabase";
import { makeTTLCache } from "@/lib/utils";

const paymentAccessCache = makeTTLCache<CoursePaymentAccess | null>(60_000);

export type PaymentPurpose = "course_purchase" | "certificate_fee" | "ai_subscription";
export type AiSubscriptionTier = "student" | "pro" | "bootcamp";
export type AiSubscriptionDurationMonths = 1 | 12;

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
  original_amount_vnd?: number | null;
  discount_code?: string | null;
  discount_amount_vnd?: number | null;
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
  status: "active" | "expired" | "cancelled" | "superseded";
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
  voucherCode?: string;
}

export interface AiVoucherPreview {
  code: string;
  percent_off: number;
  base_amount_vnd: number;
  discount_amount_vnd: number;
  final_amount_vnd: number;
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
    voucherCode: payload.voucherCode,
    tier: payload.tier,
    durationMonths: payload.durationMonths,
  } as CreateSePayCheckoutInput & {
    voucherCode?: string;
    tier: AiSubscriptionTier;
    durationMonths: AiSubscriptionDurationMonths;
  });
}

export async function previewAiVoucher(payload: {
  tier: AiSubscriptionTier;
  durationMonths: AiSubscriptionDurationMonths;
  voucherCode: string;
}): Promise<AiVoucherPreview> {
  const endpoint =
    import.meta.env.VITE_AI_VOUCHER_PREVIEW_API ||
    coreliaEdgeUrl("payments.ai.voucher.preview");
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
    AiVoucherPreview & { message?: string }
  >;
  if (
    !res.ok ||
    !data.code ||
    typeof data.percent_off !== "number" ||
    typeof data.base_amount_vnd !== "number" ||
    typeof data.discount_amount_vnd !== "number" ||
    typeof data.final_amount_vnd !== "number"
  ) {
    throw new Error(data.message || "Không áp dụng được voucher.");
  }
  return {
    code: data.code,
    percent_off: data.percent_off,
    base_amount_vnd: data.base_amount_vnd,
    discount_amount_vnd: data.discount_amount_vnd,
    final_amount_vnd: data.final_amount_vnd,
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

export function isAiSubscriptionActive(
  sub: AiSubscription | null | undefined,
  referenceDate: Date = new Date(),
): boolean {
  if (!sub) return false;
  if (sub.status !== "active") return false;
  if (!sub.expires_at) return false;
  const expiryTime = new Date(sub.expires_at).getTime();
  return Number.isFinite(expiryTime) && expiryTime > referenceDate.getTime();
}

export function resolveEffectiveAiTier(
  sub: AiSubscription | null | undefined,
  referenceDate: Date = new Date(),
): AiSubscriptionTier | "free" {
  return isAiSubscriptionActive(sub, referenceDate) && sub?.tier ? sub.tier : "free";
}

export async function getMyAiSubscription(
  referenceDate: Date = new Date(),
): Promise<AiSubscription | null> {
  const token = await getAccessToken();
  requireAccessToken(token);
  const nowIso = referenceDate.toISOString();
  const { data, error } = await supabase
    .from("ai_subscriptions")
    .select("*")
    .eq("status", "active")
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const sub = { ...data } as AiSubscription;
  return isAiSubscriptionActive(sub, referenceDate) ? sub : null;
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
