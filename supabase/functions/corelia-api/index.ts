/**
 * Corelia API — Supabase Edge Function (Deno).
 * Invoke: GET/POST {SUPABASE_URL}/functions/v1/corelia-api?op=<operation>
 *
 * Operations: health | payments.sepay.checkout | payments.transactions |
 *   payments.sepay.verify | payments.sepay.ipn | certificates.issue
 */
import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type PaymentPurpose = "course_purchase" | "certificate_fee";

type PaymentTransaction = {
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

type SePayIpnPayload = {
  notification_type?: string;
  order?: { order_invoice_number?: string; order_amount?: string };
};

type SePayOrderListItem = {
  order_invoice_number?: string;
  order_status?: string;
  order_amount?: string;
};

type GoogleMeetSpaceResponse = { name?: string; meetingUri?: string; meetingCode?: string };

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-secret-key, x-supabase-api-version",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ae = new TextEncoder().encode(a);
  const be = new TextEncoder().encode(b);
  let d = 0;
  for (let i = 0; i < ae.length; i++) d |= ae[i]! ^ be[i]!;
  return d === 0;
}

function randomHex(bytes: number): string {
  const u = new Uint8Array(bytes);
  crypto.getRandomValues(u);
  return Array.from(u, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemPkcs8ToBinary(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function rsaSignPkcs1Sha256(privateKeyPem: string, message: string): Promise<Uint8Array> {
  const pk = await crypto.subtle.importKey(
    "pkcs8",
    pemPkcs8ToBinary(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    pk,
    new TextEncoder().encode(message),
  );
  return new Uint8Array(sig);
}

function bytesToBase64Url(buf: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sepayPgApiBaseUrl(): string {
  const explicit = Deno.env.get("SEPAY_PGAPI_BASE_URL")?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const sandbox = String(Deno.env.get("SEPAY_SANDBOX") ?? "").toLowerCase() === "true";
  return sandbox ? "https://pgapi-sandbox.sepay.vn" : "https://pgapi.sepay.vn";
}

function sepayBasicAuthHeader(): string {
  const merchantId = requireEnv("SEPAY_MERCHANT_ID");
  const secretKey = requireEnv("SEPAY_SECRET_KEY");
  const raw = `${merchantId}:${secretKey}`;
  return `Basic ${btoa(raw)}`;
}

async function fetchSePayOrderByInvoiceNumber(
  invoiceNumber: string,
  userId?: string,
): Promise<SePayOrderListItem | null> {
  const url = new URL(`${sepayPgApiBaseUrl()}/v1/order`);
  url.searchParams.set("q", invoiceNumber);
  url.searchParams.set("per_page", "20");
  url.searchParams.set("page", "1");
  url.searchParams.set("sort", "created_at:desc");
  if (userId) url.searchParams.set("customer_id", userId);
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: sepayBasicAuthHeader(), "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SePay order lookup failed (${res.status}): ${text || "empty response"}`);
  }
  const data = (await res.json().catch(() => ({}))) as { data?: SePayOrderListItem[] };
  const orders = Array.isArray(data.data) ? data.data : [];
  return orders.find((item) => item.order_invoice_number === invoiceNumber) ?? null;
}

function createServiceClient(): SupabaseClient {
  const url = requireEnv("SUPABASE_URL").trim();
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function verifyBearerUser(req: Request, db: SupabaseClient): Promise<User> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) throw new Error("Missing Authorization header");
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error("Invalid Authorization header");
  const { data, error } = await db.auth.getUser(m[1]!);
  if (error || !data.user) throw new Error("Invalid or expired session");
  return data.user;
}

function isAuthFailure(message: string): boolean {
  return /authorization|session|jwt|token/i.test(message);
}

async function getUserRole(db: SupabaseClient, uid: string): Promise<string> {
  const { data, error } = await db.from("profiles").select("role").eq("id", uid).maybeSingle();
  if (error) throw new Error(error.message);
  return String(data?.role ?? "");
}

async function getProfileDoc(
  db: SupabaseClient,
  uid: string,
): Promise<{ role?: string; instructor_origin?: string | null }> {
  const { data, error } = await db.from("profiles").select("role, instructor_origin").eq("id", uid).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? {}) as { role?: string; instructor_origin?: string | null };
}

function isCoInstructor(courseData: Record<string, unknown>, userId: string): boolean {
  const perms = courseData.co_instructor_permissions;
  if (!perms || typeof perms !== "object" || Array.isArray(perms)) return false;
  return Object.prototype.hasOwnProperty.call(perms as object, userId);
}

async function canManageCourse(db: SupabaseClient, uid: string, courseId: string): Promise<boolean> {
  const [role, courseRes] = await Promise.all([
    getUserRole(db, uid),
    db.from("courses").select("instructor_id, data").eq("id", courseId).maybeSingle(),
  ]);
  if (courseRes.error) throw new Error(courseRes.error.message);
  if (!courseRes.data) return false;
  if (role === "admin" || role === "support_staff") return true;
  if (role !== "instructor") return false;
  if (String(courseRes.data.instructor_id ?? "") === uid) return true;
  const data = (courseRes.data.data ?? {}) as Record<string, unknown>;
  return isCoInstructor(data, uid);
}

async function grantPaymentAccessForTransaction(
  db: SupabaseClient,
  tx: PaymentTransaction,
  invoiceNumber: string,
  updatedAt: string,
  providerPayload: unknown,
) {
  const accessId = `${tx.user_id}_${tx.course_id}`;
  const { data: existingAccess } = await db
    .from("course_payment_access")
    .select("full_access_granted, certificate_fee_paid")
    .eq("id", accessId)
    .maybeSingle();
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

function getSePayEnv(): "sandbox" | "production" {
  return String(Deno.env.get("SEPAY_ENV") ?? "sandbox").toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

function sepayCheckoutInitUrl(): string {
  return getSePayEnv() === "production"
    ? "https://pay.sepay.vn/v1/checkout/init"
    : "https://pay-sandbox.sepay.vn/v1/checkout/init";
}

async function buildSePaySignature(fields: Record<string, string>, secretKey: string): Promise<string> {
  const signedFields = [
    "merchant",
    "operation",
    "payment_method",
    "order_amount",
    "currency",
    "order_invoice_number",
    "order_description",
    "customer_id",
    "success_url",
    "error_url",
    "cancel_url",
  ] as const;
  const signedString = signedFields
    .filter((k) => k in fields)
    .map((k) => `${k}=${fields[k] ?? ""}`)
    .join(",");
  return await hmacSha256Base64(secretKey, signedString);
}

async function getGoogleMeetAccessToken(): Promise<string> {
  const clientEmail = requireEnv("GOOGLE_MEET_CLIENT_EMAIL");
  const privateKey = requireEnv("GOOGLE_MEET_PRIVATE_KEY").replace(/\\n/g, "\n");
  const delegatedUser = requireEnv("GOOGLE_MEET_DELEGATED_USER");
  const now = Math.floor(Date.now() / 1000);
  const scope = [
    "https://www.googleapis.com/auth/meetings.space.created",
    "https://www.googleapis.com/auth/meetings.space.settings",
  ].join(" ");
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    sub: delegatedUser,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))
    }`;
  const sigBytes = await rsaSignPkcs1Sha256(privateKey, unsigned);
  const assertion = `${unsigned}.${bytesToBase64Url(sigBytes)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Không lấy được Google access token.");
  }
  return json.access_token;
}

async function meetApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await getGoogleMeetAccessToken();
  const res = await fetch(`https://meet.googleapis.com/v2${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await res.json().catch(() => ({}))) as T & {
    message?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(payload.error?.message || payload.message || `Google Meet API error (${res.status})`);
  }
  return payload;
}

async function handleSePayCheckout(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const courseId = String(body.courseId ?? "");
    const purpose = body.purpose === "course_purchase" || body.purpose === "certificate_fee"
      ? body.purpose as PaymentPurpose
      : null;
    const requestedAmountVnd = Number(body.amountVnd ?? 0);
    const successUrl = String(body.successUrl ?? "");
    const errorUrl = String(body.errorUrl ?? "");
    const cancelUrl = String(body.cancelUrl ?? "");
    const discountCodeRaw = String(body.discountCode ?? "").trim();
    if (!courseId) return json({ message: "Thiếu courseId" }, 400);
    if (!purpose) return json({ message: "Thiếu/ sai purpose" }, 400);
    if (!Number.isFinite(requestedAmountVnd) || requestedAmountVnd <= 0) {
      return json({ message: "amountVnd không hợp lệ" }, 400);
    }
    if (!/^https?:\/\//.test(successUrl) || !/^https?:\/\//.test(errorUrl) || !/^https?:\/\//.test(cancelUrl)) {
      return json({ message: "Callback URLs không hợp lệ" }, 400);
    }
    const merchantId = requireEnv("SEPAY_MERCHANT_ID");
    const secretKey = requireEnv("SEPAY_SECRET_KEY");
    const { data: courseRow, error: courseErr } = await db.from("courses").select("data").eq("id", courseId)
      .maybeSingle();
    if (courseErr) throw new Error(courseErr.message);
    if (!courseRow) return json({ message: "Không tìm thấy khoá học" }, 404);
    const course = (courseRow.data ?? {}) as {
      price_vnd?: number | null;
      promo_price_vnd?: number | null;
      promo_ends_at?: string | null;
      certificate_fee_vnd?: number | null;
    };
    const basePrice = Math.round(Number(course.price_vnd ?? 0));
    const promoPrice = Math.round(Number(course.promo_price_vnd ?? 0));
    const promoEndsAt = course.promo_ends_at ? Date.parse(course.promo_ends_at) : NaN;
    const promoActive =
      Number.isFinite(basePrice) &&
      basePrice > 0 &&
      promoPrice > 0 &&
      promoPrice < basePrice &&
      (!Number.isFinite(promoEndsAt) || Date.now() <= promoEndsAt);
    const baseAmount = purpose === "course_purchase"
      ? (promoActive ? promoPrice : basePrice)
      : Math.round(Number(course.certificate_fee_vnd ?? 0));
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      return json({ message: "Khoá học chưa cấu hình phí hợp lệ" }, 400);
    }
    let finalAmount = baseAmount;
    let discountCode: string | undefined;
    let discountAmount = 0;
    if (purpose === "course_purchase" && discountCodeRaw) {
      const normalized = discountCodeRaw.toUpperCase();
      const { data: discRows, error: discErr } = await db.from("course_discounts").select("*").eq(
        "course_id",
        courseId,
      ).eq("code", normalized).eq("active", true).limit(1);
      if (discErr) throw new Error(discErr.message);
      const d = discRows?.[0] as {
        type: "percent" | "amount_vnd";
        value: number;
        starts_at?: string | null;
        ends_at?: string | null;
        max_redemptions?: number | null;
        redeemed_count?: number | null;
      } | undefined;
      if (d) {
        const now = Date.now();
        const startsOk = !d.starts_at || Date.parse(d.starts_at) <= now;
        const endsOk = !d.ends_at || Date.parse(d.ends_at) >= now;
        const capOk = d.max_redemptions == null ||
          Number(d.redeemed_count ?? 0) < Number(d.max_redemptions ?? 0);
        if (startsOk && endsOk && capOk) {
          discountCode = normalized;
          if (d.type === "percent") {
            const pct = Math.max(0, Math.min(100, Math.round(Number(d.value ?? 0))));
            discountAmount = Math.round((baseAmount * pct) / 100);
          } else discountAmount = Math.round(Number(d.value ?? 0));
          discountAmount = Math.max(0, Math.min(baseAmount, discountAmount));
          finalAmount = Math.max(0, baseAmount - discountAmount);
        }
      }
    }
    const orderId = `CORELIA-${Date.now()}-${randomHex(6)}`;
    const createdAt = nowIso();
    const tx: PaymentTransaction = {
      user_id: user.id,
      course_id: courseId,
      purpose,
      amount_vnd: Math.round(finalAmount),
      original_amount_vnd: baseAmount,
      discount_code: discountCode ?? null,
      discount_amount_vnd: discountCode ? discountAmount : null,
      provider: "sepay",
      status: "pending",
      created_at: createdAt,
      updated_at: createdAt,
    };
    const { error: insErr } = await db.from("payment_transactions").insert({
      id: orderId,
      user_id: tx.user_id,
      course_id: tx.course_id,
      purpose: tx.purpose,
      amount_vnd: tx.amount_vnd,
      original_amount_vnd: tx.original_amount_vnd ?? undefined,
      discount_code: tx.discount_code,
      discount_amount_vnd: tx.discount_amount_vnd ?? undefined,
      provider: "sepay",
      status: "pending",
      created_at: createdAt,
      updated_at: createdAt,
    });
    if (insErr) throw new Error(insErr.message);
    const fields: Record<string, string> = {
      merchant: merchantId,
      operation: "PURCHASE",
      payment_method: "BANK_TRANSFER",
      order_amount: String(Math.round(finalAmount)),
      currency: "VND",
      order_invoice_number: orderId,
      order_description: purpose === "course_purchase"
        ? `Thanh toán khoá học ${courseId}`
        : `Thanh toán phí chứng nhận ${courseId}`,
      customer_id: user.id,
      success_url: successUrl,
      error_url: errorUrl,
      cancel_url: cancelUrl,
    };
    const signature = await buildSePaySignature(fields, secretKey);
    return json({
      checkout_url: sepayCheckoutInitUrl(),
      order_id: orderId,
      fields: { ...fields, signature },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập" }, 401);
    console.error("[corelia-api] checkout", e);
    return json({ message: "Không tạo được phiên thanh toán SePay." }, 500);
  }
}

async function handleMyPaymentTransactions(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const { data: rows, error } = await db.from("payment_transactions").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    const list = (rows ?? []).map((r) => ({ id: r.id, ...r }));
    return json({ transactions: list });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập" }, 401);
    console.error("[corelia-api] transactions", e);
    return json({ message: "Không lấy được lịch sử thanh toán." }, 500);
  }
}

async function handleIssueCertificate(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const courseId = String(body.courseId ?? "").trim();
    const targetUserId = String(body.userId ?? user.id).trim();
    if (!courseId) return json({ message: "Thiếu courseId", issued: false }, 400);
    if (!targetUserId) return json({ message: "Thiếu userId", issued: false }, 400);
    if (user.id !== targetUserId) {
      if (!await canManageCourse(db, user.id, courseId)) {
        return json({ message: "Không đủ quyền cấp chứng nhận.", issued: false }, 403);
      }
    }
    const enrollmentId = `${targetUserId}_${courseId}`;
    const [{ data: courseRow, error: courseErr }, { data: enrollment, error: enrErr }] = await Promise.all([
      db.from("courses").select("data").eq("id", courseId).maybeSingle(),
      db.from("enrollments").select("*").eq("id", enrollmentId).maybeSingle(),
    ]);
    if (courseErr) throw new Error(courseErr.message);
    if (enrErr) throw new Error(enrErr.message);
    if (!courseRow) return json({ message: "Không tìm thấy khoá học.", issued: false }, 404);
    if (!enrollment) return json({ message: "Học viên chưa ghi danh.", issued: false }, 400);
    const course = (courseRow.data ?? {}) as {
      access_model?: string | null;
      final_assignment_title?: string | null;
    };
    if (enrollment.certificate_issued_at) {
      return json({ issued: true, certificate_issued_at: enrollment.certificate_issued_at });
    }
    if (course.access_model === "free_with_paid_certificate") {
      const accessId = `${targetUserId}_${courseId}`;
      const { data: payAccess, error: payErr } = await db.from("course_payment_access").select(
        "certificate_fee_paid",
      ).eq("id", accessId).maybeSingle();
      if (payErr) throw new Error(payErr.message);
      if (payAccess?.certificate_fee_paid !== true) return json({ issued: false });
    }
    const { data: readinessRaw, error: readyErr } = await db.rpc("corelia_certificate_readiness", {
      p_course_id: courseId,
      p_user_id: targetUserId,
    });
    if (readyErr) throw new Error(readyErr.message);
    const readiness = readinessRaw as {
      all_lessons_complete?: boolean;
      final_assignment_required?: boolean;
      final_submission_status?: string | null;
    } | null;
    if (!readiness?.all_lessons_complete) return json({ issued: false });
    if (readiness.final_assignment_required && readiness.final_submission_status !== "approved") {
      return json({ issued: false });
    }
    const issuedAt = nowIso();
    const { error: upErr } = await db.from("enrollments").update({ certificate_issued_at: issuedAt }).eq(
      "id",
      enrollmentId,
    );
    if (upErr) throw new Error(upErr.message);
    return json({ issued: true, certificate_issued_at: issuedAt });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập", issued: false }, 401);
    console.error("[corelia-api] certificate", e);
    return json({ message: "Không thể cấp chứng nhận.", issued: false }, 500);
  }
}

async function handleVerifySePayPayment(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const explicitOrderId = String(body.orderId ?? "").trim();
    const courseId = String(body.courseId ?? "").trim();
    const purpose = body.purpose === "course_purchase" || body.purpose === "certificate_fee"
      ? (body.purpose as PaymentPurpose)
      : undefined;
    let orderRow: ({ id: string } & PaymentTransaction) | null = null;
    if (explicitOrderId) {
      const { data, error } = await db.from("payment_transactions").select("*").eq("id", explicitOrderId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return json({ message: "Không tìm thấy giao dịch." }, 404);
      orderRow = data as { id: string } & PaymentTransaction;
    } else {
      if (!courseId || !purpose) {
        return json({ message: "Thiếu orderId hoặc cặp courseId/purpose." }, 400);
      }
      const { data: rows, error } = await db.from("payment_transactions").select("*").eq("user_id", user.id).eq(
        "course_id",
        courseId,
      ).eq("purpose", purpose).order("created_at", { ascending: false }).limit(20);
      if (error) throw new Error(error.message);
      if (!rows?.length) return json({ message: "Chưa có giao dịch nào phù hợp." }, 404);
      orderRow = rows[0] as { id: string } & PaymentTransaction;
    }
    if (!orderRow) return json({ message: "Không tìm thấy giao dịch." }, 404);
    const tx = orderRow;
    if (tx.user_id !== user.id) return json({ message: "Không có quyền xem giao dịch này." }, 403);
    const accessId = `${tx.user_id}_${tx.course_id}`;
    const enrollmentId = `${tx.user_id}_${tx.course_id}`;
    const [{ data: accessBefore }, { data: enrollmentBefore }] = await Promise.all([
      db.from("course_payment_access").select("*").eq("id", accessId).maybeSingle(),
      db.from("enrollments").select("id").eq("id", enrollmentId).maybeSingle(),
    ]);
    const alreadyGranted =
      (tx.purpose === "course_purchase" && accessBefore?.full_access_granted === true) ||
      (tx.purpose === "certificate_fee" && accessBefore?.certificate_fee_paid === true);
    let verifiedBy: "transaction" | "sepay_lookup" | "pending" = "pending";
    if (tx.status === "paid" && !alreadyGranted) {
      await grantPaymentAccessForTransaction(db, tx, orderRow.id, nowIso(), {
        source: "verify_endpoint_reconcile",
        original_provider_payload: tx.provider_payload ?? null,
      });
      verifiedBy = "transaction";
    } else if (tx.status === "paid") verifiedBy = "transaction";
    else {
      const sepayOrder = await fetchSePayOrderByInvoiceNumber(orderRow.id, tx.user_id);
      if (sepayOrder?.order_status === "CAPTURED") {
        await grantPaymentAccessForTransaction(db, tx, orderRow.id, nowIso(), {
          source: "verify_endpoint_sepay_lookup",
          sepay_order: sepayOrder,
        });
        verifiedBy = "sepay_lookup";
      }
    }
    const [{ data: freshTx }, { data: access }, { data: enrollment }] = await Promise.all([
      db.from("payment_transactions").select("*").eq("id", orderRow.id).maybeSingle(),
      db.from("course_payment_access").select("*").eq("id", accessId).maybeSingle(),
      db.from("enrollments").select("id").eq("id", enrollmentId).maybeSingle(),
    ]);
    const fresh = freshTx as PaymentTransaction | null | undefined;
    return json({
      order_id: orderRow.id,
      status: fresh?.status ?? tx.status,
      purpose: tx.purpose,
      course_id: tx.course_id,
      full_access_granted: access?.full_access_granted === true,
      certificate_fee_paid: access?.certificate_fee_paid === true,
      enrolled: !!enrollment || !!enrollmentBefore,
      verified_by: verifiedBy,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập" }, 401);
    console.error("[corelia-api] verify", e);
    return json({ message: "Không thể xác minh thanh toán lúc này." }, 500);
  }
}

async function handleSePayIpn(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const expected = Deno.env.get("SEPAY_IPN_SECRET") ?? Deno.env.get("SEPAY_SECRET_KEY") ?? "";
    if (!expected) throw new Error("Missing env: SEPAY_IPN_SECRET (or SEPAY_SECRET_KEY)");
    const got = req.headers.get("x-secret-key") ?? req.headers.get("X-Secret-Key") ?? "";
    if (!got || !timingSafeEqual(got, expected)) {
      return json({ message: "Invalid IPN secret" }, 401);
    }
    const payload = (await req.json().catch(() => ({}))) as SePayIpnPayload;
    const type = payload.notification_type;
    const invoiceNumber = payload.order?.order_invoice_number;
    const orderAmount = payload.order?.order_amount;
    if (!invoiceNumber || typeof invoiceNumber !== "string") {
      return json({ message: "Missing order_invoice_number" }, 400);
    }
    const { data: snap, error: fetchErr } = await db.from("payment_transactions").select("*").eq(
      "id",
      invoiceNumber,
    ).maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!snap) {
      console.warn("[corelia-api] IPN unknown invoice", invoiceNumber);
      return json({ ok: true });
    }
    const tx = snap as PaymentTransaction;
    const updatedAt = nowIso();
    if (tx.status === "paid") return json({ ok: true });
    if (type === "ORDER_PAID") {
      const expectedAmount = Math.round(Number(tx.amount_vnd ?? 0));
      const paidAmount = Math.round(Number(orderAmount ?? 0));
      if (!Number.isFinite(paidAmount) || paidAmount <= 0 || paidAmount !== expectedAmount) {
        console.error("[corelia-api] IPN amount mismatch", { invoiceNumber, expectedAmount, paidAmount });
        return json({ message: "Amount mismatch" }, 400);
      }
      await db.from("payment_transactions").update({
        status: "paid",
        provider_payload: payload as unknown as Record<string, unknown>,
        updated_at: updatedAt,
      }).eq("id", invoiceNumber);
      await grantPaymentAccessForTransaction(db, tx, invoiceNumber, updatedAt, payload);
      return json({ ok: true });
    }
    await db.from("payment_transactions").update({
      provider_payload: payload as unknown as Record<string, unknown>,
      updated_at: updatedAt,
    }).eq("id", invoiceNumber);
    return json({ ok: true });
  } catch (e) {
    console.error("[corelia-api] IPN", e);
    return json({ ok: false }, 500);
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  const url = new URL(req.url);
  const op = url.searchParams.get("op") ?? "";
  let db: SupabaseClient;
  try {
    db = createServiceClient();
  } catch (e) {
    console.error("[corelia-api] boot", e);
    return json({ message: "Server misconfiguration" }, 500);
  }
  if (op === "health" && req.method === "GET") return json({ ok: true });
  if (op === "payments.sepay.checkout" && req.method === "POST") {
    return await handleSePayCheckout(req, db);
  }
  if (op === "payments.transactions" && req.method === "GET") {
    return await handleMyPaymentTransactions(req, db);
  }
  if (op === "certificates.issue" && req.method === "POST") {
    return await handleIssueCertificate(req, db);
  }
  if (op === "payments.sepay.verify" && req.method === "POST") {
    return await handleVerifySePayPayment(req, db);
  }
  if (op === "payments.sepay.ipn" && req.method === "POST") {
    return await handleSePayIpn(req, db);
  }
  return json({ message: "Unknown or disallowed op / method", op }, 404);
});
