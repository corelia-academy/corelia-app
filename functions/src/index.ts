import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import admin from "firebase-admin";

admin.initializeApp();

type PaymentPurpose = "course_purchase" | "certificate_fee";

type CheckoutRequestBody = {
  courseId: string;
  purpose: PaymentPurpose;
  amountVnd: number;
  successUrl: string;
  errorUrl: string;
  cancelUrl: string;
  discountCode?: string;
};

type CheckoutResponseBody = {
  checkout_url: string;
  order_id: string;
  fields: Record<string, string>;
};

type VerifyPaymentRequestBody = {
  orderId?: string;
  courseId?: string;
  purpose?: PaymentPurpose;
};

type IssueCertificateRequestBody = {
  courseId: string;
  userId?: string;
};

type PaymentTransaction = {
  user_id: string;
  course_id: string;
  purpose: PaymentPurpose;
  amount_vnd: number;
  original_amount_vnd?: number;
  discount_code?: string | null;
  discount_amount_vnd?: number | null;
  provider: "sepay";
  status: "pending" | "paid" | "failed" | "cancelled";
  provider_payload?: unknown;
  created_at: string;
  updated_at: string;
};

type EnrollmentDoc = {
  user_id: string;
  course_id: string;
  enrolled_at: string;
  last_accessed_at: string;
  // Payment metadata (optional; only set for paid purchases)
  paid_provider?: "sepay";
  paid_amount_vnd?: number;
  paid_order_id?: string;
  paid_at?: string;
};

type CoursePaymentAccess = {
  user_id: string;
  course_id: string;
  full_access_granted?: boolean;
  certificate_fee_paid?: boolean;
  updated_at: string;
};

type LessonDoc = {
  id: string;
};

type LessonProgressDoc = {
  lesson_id: string;
  completed_at?: string | null;
};

type FinalAssignmentSubmissionDoc = {
  status?: "pending" | "approved" | "rejected";
};

type MeetCreateSpaceRequestBody = {
  courseId: string;
  cohortId: string;
  sessionId: string;
};

type OfflineCohortDoc = {
  offline_course_id?: string;
  title?: string;
  meeting_provider?: "zoom" | "google_meet" | "manual";
  instructor_id?: string;
  coordinator_ids?: string[];
  zoom_host_email?: string | null;
};

type OfflineSessionDoc = {
  cohort_id?: string;
  title?: string;
  summary?: string | null;
  week_index?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  zoom_meeting_id?: string | null;
  zoom_meeting_uuid?: string | null;
  zoom_join_url?: string | null;
  zoom_start_url?: string | null;
};

type GoogleOAuthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type GoogleMeetSpaceResponse = {
  name?: string;
  meetingUri?: string;
  meetingCode?: string;
};

type SePayIpnPayload = {
  notification_type?: string;
  order?: {
    order_invoice_number?: string;
    order_amount?: string;
  };
};

type SePayOrderListItem = {
  order_id?: string;
  order_invoice_number?: string;
  order_status?: string;
  order_amount?: string;
  customer_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function timingSafeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function sepayPgApiBaseUrl() {
  const explicit = process.env.SEPAY_PGAPI_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const sandbox = String(process.env.SEPAY_SANDBOX ?? "").toLowerCase() === "true";
  return sandbox ? "https://pgapi-sandbox.sepay.vn" : "https://pgapi.sepay.vn";
}

function sepayBasicAuthHeader() {
  const merchantId = requireEnv("SEPAY_MERCHANT_ID");
  const secretKey = requireEnv("SEPAY_SECRET_KEY");
  const raw = `${merchantId}:${secretKey}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
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
    headers: {
      Authorization: sepayBasicAuthHeader(),
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SePay order lookup failed (${res.status}): ${text || "empty response"}`);
  }

  const data = (await res.json().catch(() => ({}))) as {
    data?: SePayOrderListItem[];
  };
  const orders = Array.isArray(data.data) ? data.data : [];
  const matched = orders.find((item) => item.order_invoice_number === invoiceNumber);
  return matched ?? null;
}

async function grantPaymentAccessForTransaction(
  tx: PaymentTransaction,
  invoiceNumber: string,
  updatedAt: string,
  providerPayload: unknown,
) {
  const accessId = `${tx.user_id}_${tx.course_id}`;
  const accessRef = admin.firestore().doc(`course_payment_access/${accessId}`);
  const access: CoursePaymentAccess = {
    user_id: tx.user_id,
    course_id: tx.course_id,
    updated_at: updatedAt,
    ...(tx.purpose === "course_purchase"
      ? { full_access_granted: true }
      : { certificate_fee_paid: true }),
  };
  await accessRef.set(access, { merge: true });

  if (tx.purpose === "course_purchase") {
    const enrSnap = await admin
      .firestore()
      .collection("enrollments")
      .where("user_id", "==", tx.user_id)
      .where("course_id", "==", tx.course_id)
      .limit(1)
      .get();

    const enrData: EnrollmentDoc = {
      user_id: tx.user_id,
      course_id: tx.course_id,
      enrolled_at: updatedAt,
      last_accessed_at: updatedAt,
      paid_provider: "sepay",
      paid_amount_vnd: Number(tx.amount_vnd ?? 0),
      paid_order_id: invoiceNumber,
      paid_at: updatedAt,
    };

    if (enrSnap.empty) {
      await admin
        .firestore()
        .doc(`enrollments/${tx.user_id}_${tx.course_id}`)
        .set(enrData, { merge: true });
    } else {
      await enrSnap.docs[0]!.ref.set(enrData, { merge: true });
    }
  }

  await admin.firestore().doc(`payment_transactions/${invoiceNumber}`).set(
    {
      status: "paid",
      provider_payload: providerPayload,
      updated_at: updatedAt,
    },
    { merge: true },
  );
}

function getSePayEnv(): "sandbox" | "production" {
  const raw = (process.env.SEPAY_ENV ?? "sandbox").toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

function sepayCheckoutInitUrl(): string {
  // Docs: https://developer.sepay.vn/vi/cong-thanh-toan/bat-dau
  return getSePayEnv() === "production"
    ? "https://pay.sepay.vn/v1/checkout/init"
    : "https://pay-sandbox.sepay.vn/v1/checkout/init";
}

function base64HmacSha256(input: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(input).digest("base64");
}

function buildSePaySignature(fields: Record<string, string>, secretKey: string) {
  // Order and allowed fields must match SePay docs.
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

  return base64HmacSha256(signedString, secretKey);
}

async function verifyFirebaseAuth(req: express.Request) {
  const header = req.header("authorization") ?? req.header("Authorization");
  if (!header) throw new Error("Missing Authorization header");
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error("Invalid Authorization header");
  const token = m[1]!;
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (e) {
    logger.warn("Invalid Firebase ID token", e);
    throw new Error("Invalid Firebase ID token");
  }
}

async function getUserRole(uid: string) {
  const snap = await admin.firestore().doc(`profiles/${uid}`).get();
  return String(snap.data()?.role ?? "");
}

async function canManageCourse(uid: string, courseId: string) {
  const [role, courseSnap] = await Promise.all([
    getUserRole(uid),
    admin.firestore().doc(`courses/${courseId}`).get(),
  ]);

  if (!courseSnap.exists) return false;
  if (role === "admin" || role === "support_staff") return true;
  if (role !== "instructor") return false;
  return String(courseSnap.data()?.instructor_id ?? "") === uid;
}

async function getProfileDoc(uid: string) {
  const snap = await admin.firestore().doc(`profiles/${uid}`).get();
  return (snap.data() ?? {}) as { role?: string; instructor_origin?: string };
}

async function canManageOfflineCohort(uid: string, cohortId: string) {
  const [profile, cohortSnap] = await Promise.all([
    getProfileDoc(uid),
    admin.firestore().doc(`offline_cohorts/${cohortId}`).get(),
  ]);

  if (!cohortSnap.exists) return false;
  const cohort = cohortSnap.data() as OfflineCohortDoc;
  if (profile.role === "admin" || profile.role === "support_staff") return true;
  if (profile.role !== "instructor" || profile.instructor_origin !== "corelia") return false;
  if (String(cohort.instructor_id ?? "") === uid) return true;
  return (cohort.coordinator_ids ?? []).includes(uid);
}

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function googleMeetEnv() {
  return {
    clientEmail: requireEnv("GOOGLE_MEET_CLIENT_EMAIL"),
    privateKey: requireEnv("GOOGLE_MEET_PRIVATE_KEY").replace(/\\n/g, "\n"),
    delegatedUser: requireEnv("GOOGLE_MEET_DELEGATED_USER"),
  };
}

async function getGoogleMeetAccessToken() {
  const { clientEmail, privateKey, delegatedUser } = googleMeetEnv();
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
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload),
  )}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), privateKey);
  const assertion = `${unsigned}.${base64UrlEncode(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as Partial<GoogleOAuthTokenResponse> & {
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

async function handleCreateOfflineSessionMeetSpace(
  req: express.Request,
  res: express.Response,
) {
  try {
    const decoded = await verifyFirebaseAuth(req);
    const body = (req.body ?? {}) as Partial<MeetCreateSpaceRequestBody>;
    const courseId = String(body.courseId ?? "").trim();
    const cohortId = String(body.cohortId ?? "").trim();
    const sessionId = String(body.sessionId ?? "").trim();

    if (!courseId || !cohortId || !sessionId) {
      return res.status(400).json({ message: "Thiếu courseId, cohortId hoặc sessionId." });
    }

    const canManage = await canManageOfflineCohort(decoded.uid, cohortId);
    if (!canManage) {
      return res.status(403).json({ message: "Không đủ quyền quản lý cohort này." });
    }

    const db = admin.firestore();
    const cohortRef = db.doc(`offline_cohorts/${cohortId}`);
    const sessionRef = db.doc(`offline_cohorts/${cohortId}/sessions/${sessionId}`);
    const [cohortSnap, sessionSnap] = await Promise.all([cohortRef.get(), sessionRef.get()]);

    if (!cohortSnap.exists) {
      return res.status(404).json({ message: "Không tìm thấy cohort." });
    }
    if (!sessionSnap.exists) {
      return res.status(404).json({ message: "Không tìm thấy buổi học." });
    }

    const cohort = cohortSnap.data() as OfflineCohortDoc;
    const session = sessionSnap.data() as OfflineSessionDoc;

    if (String(cohort.offline_course_id ?? "") !== courseId) {
      return res.status(400).json({ message: "Cohort không thuộc khoá học này." });
    }
    if (cohort.meeting_provider !== "google_meet") {
      return res.status(400).json({ message: "Cohort này không dùng Google Meet." });
    }

    const existingMeetingUri = String(session.zoom_join_url ?? "").trim();
    const existingMeetingName = String(session.zoom_meeting_id ?? "").trim();
    if (existingMeetingUri && existingMeetingName) {
      return res.status(200).json({
        session_id: sessionId,
        meeting_name: existingMeetingName,
        meeting_uri: existingMeetingUri,
        meeting_code: String(session.zoom_meeting_uuid ?? "").trim() || null,
        reused: true,
      });
    }

    const meetSpace = await meetApiFetch<GoogleMeetSpaceResponse>("/spaces", {
      method: "POST",
      body: JSON.stringify({}),
    });

    if (!meetSpace.name || !meetSpace.meetingUri) {
      throw new Error("Google Meet API không trả về meeting space hợp lệ.");
    }

    const updatedAt = nowIso();
    await sessionRef.set(
      {
        zoom_meeting_id: meetSpace.name,
        zoom_meeting_uuid: meetSpace.meetingCode ?? null,
        zoom_join_url: meetSpace.meetingUri,
        zoom_start_url: meetSpace.meetingUri,
        meeting_status: "scheduled",
        attendance_source: "zoom_import",
        recording_sync_status: "pending",
        last_zoom_sync_at: updatedAt,
        updated_at: updatedAt,
      },
      { merge: true },
    );

    logger.info("Created Google Meet space for offline session", {
      uid: decoded.uid,
      courseId,
      cohortId,
      sessionId,
      meetingName: meetSpace.name,
    });

    return res.status(200).json({
      session_id: sessionId,
      meeting_name: meetSpace.name,
      meeting_uri: meetSpace.meetingUri,
      meeting_code: meetSpace.meetingCode ?? null,
      reused: false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (/Authorization/i.test(message) || /Firebase ID token/i.test(message) || /App Check/i.test(message)) {
      return res.status(401).json({ message: "Chưa đăng nhập" });
    }
    logger.error("Create offline session Google Meet space error", e);
    return res.status(500).json({
      message: "Không thể tạo Google Meet tự động cho buổi học này.",
    });
  }
}


const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

async function handleSePayCheckout(req: express.Request, res: express.Response) {
  try {
    const decoded = await verifyFirebaseAuth(req);
    const uid = decoded.uid;

    const body = (req.body ?? {}) as Partial<CheckoutRequestBody>;
    const courseId = String(body.courseId ?? "");
    const purpose = body.purpose === "course_purchase" || body.purpose === "certificate_fee"
      ? body.purpose
      : null;
    const requestedAmountVnd = Number(body.amountVnd ?? 0);
    const successUrl = String(body.successUrl ?? "");
    const errorUrl = String(body.errorUrl ?? "");
    const cancelUrl = String(body.cancelUrl ?? "");
    const discountCodeRaw = String(body.discountCode ?? "").trim();

    if (!courseId) return res.status(400).json({ message: "Thiếu courseId" });
    if (!purpose) return res.status(400).json({ message: "Thiếu/ sai purpose" });
    if (!Number.isFinite(requestedAmountVnd) || requestedAmountVnd <= 0)
      return res.status(400).json({ message: "amountVnd không hợp lệ" });
    if (!/^https?:\/\//.test(successUrl) || !/^https?:\/\//.test(errorUrl) || !/^https?:\/\//.test(cancelUrl))
      return res.status(400).json({ message: "Callback URLs không hợp lệ" });

    const merchantId = requireEnv("SEPAY_MERCHANT_ID");
    const secretKey = requireEnv("SEPAY_SECRET_KEY");

    // Always compute amount server-side (prevent tampering).
    const courseSnap = await admin.firestore().doc(`courses/${courseId}`).get();
    if (!courseSnap.exists) return res.status(404).json({ message: "Không tìm thấy khoá học" });
    const course = courseSnap.data() as {
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

    const baseAmount =
      purpose === "course_purchase"
        ? (promoActive ? promoPrice : basePrice)
        : Math.round(Number(course.certificate_fee_vnd ?? 0));
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      return res.status(400).json({ message: "Khoá học chưa cấu hình phí hợp lệ" });
    }

    let finalAmount = baseAmount;
    let discountCode: string | undefined;
    let discountAmount = 0;

    if (purpose === "course_purchase" && discountCodeRaw) {
      const normalized = discountCodeRaw.toUpperCase();
      // Look for active discount in subcollection: courses/{courseId}/discounts
      const ds = await admin
        .firestore()
        .collection(`courses/${courseId}/discounts`)
        .where("code", "==", normalized)
        .where("active", "==", true)
        .limit(1)
        .get();
      if (!ds.empty) {
        const d = ds.docs[0]!.data() as {
          type: "percent" | "amount_vnd";
          value: number;
          starts_at?: string | null;
          ends_at?: string | null;
          max_redemptions?: number | null;
          redeemed_count?: number;
        };
        const now = Date.now();
        const startsOk = !d.starts_at || Date.parse(d.starts_at) <= now;
        const endsOk = !d.ends_at || Date.parse(d.ends_at) >= now;
        const capOk =
          d.max_redemptions == null ||
          Number(d.redeemed_count ?? 0) < Number(d.max_redemptions ?? 0);
        if (startsOk && endsOk && capOk) {
          discountCode = normalized;
          if (d.type === "percent") {
            const pct = Math.max(0, Math.min(100, Math.round(Number(d.value ?? 0))));
            discountAmount = Math.round((baseAmount * pct) / 100);
          } else {
            discountAmount = Math.round(Number(d.value ?? 0));
          }
          discountAmount = Math.max(0, Math.min(baseAmount, discountAmount));
          finalAmount = Math.max(0, baseAmount - discountAmount);
        }
      }
    }

    // order_invoice_number must be unique. Use Firestore doc id (order_id) as invoice number for easy lookup.
    const orderId = `CORELIA-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;

    const createdAt = nowIso();
    const tx: PaymentTransaction = {
      user_id: uid,
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

    await admin.firestore().doc(`payment_transactions/${orderId}`).set(tx, { merge: true });

    const fields: Record<string, string> = {
      merchant: merchantId,
      operation: "PURCHASE",
      payment_method: "BANK_TRANSFER",
      order_amount: String(Math.round(finalAmount)),
      currency: "VND",
      order_invoice_number: orderId,
      order_description:
        purpose === "course_purchase"
          ? `Thanh toán khoá học ${courseId}`
          : `Thanh toán phí chứng nhận ${courseId}`,
      customer_id: uid,
      success_url: successUrl,
      error_url: errorUrl,
      cancel_url: cancelUrl,
    };

    const signature = buildSePaySignature(fields, secretKey);
    const checkoutUrl = sepayCheckoutInitUrl();

    const payload: CheckoutResponseBody = {
      checkout_url: checkoutUrl,
      order_id: orderId,
      fields: { ...fields, signature },
    };

    return res.status(200).json(payload);
  } catch (e) {
    logger.error("SePay checkout error", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    // Common auth error:
    if (/Authorization/i.test(message) || /Firebase ID token/i.test(message) || /App Check/i.test(message))
      return res.status(401).json({ message: "Chưa đăng nhập" });
    return res.status(500).json({ message: "Không tạo được phiên thanh toán SePay." });
  }
}

// Support both direct Cloud Run URL and Firebase Hosting rewrite (/api/**).
app.post("/payments/sepay/checkout", handleSePayCheckout);
app.post("/api/payments/sepay/checkout", handleSePayCheckout);

async function handleMyPaymentTransactions(req: express.Request, res: express.Response) {
  try {
    const decoded = await verifyFirebaseAuth(req);
    const uid = decoded.uid;

    const snap = await admin
      .firestore()
      .collection("payment_transactions")
      .where("user_id", "==", uid)
      .limit(50)
      .get();

    logger.info("List transactions", { uid, count: snap.size });

    const rows = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>)
      .sort((a, b) =>
        String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
      );
    return res.status(200).json({ transactions: rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (/Authorization/i.test(message) || /Firebase ID token/i.test(message) || /App Check/i.test(message))
      return res.status(401).json({ message: "Chưa đăng nhập" });
    logger.error("List transactions error", e);
    return res.status(500).json({ message: "Không lấy được lịch sử thanh toán." });
  }
}

app.get("/payments/transactions", handleMyPaymentTransactions);
app.get("/api/payments/transactions", handleMyPaymentTransactions);

async function handleIssueCertificate(req: express.Request, res: express.Response) {
  try {
    const decoded = await verifyFirebaseAuth(req);
    const body = (req.body ?? {}) as Partial<IssueCertificateRequestBody>;
    const courseId = String(body.courseId ?? "").trim();
    const targetUserId = String(body.userId ?? decoded.uid).trim();

    if (!courseId) {
      return res.status(400).json({ message: "Thiếu courseId", issued: false });
    }
    if (!targetUserId) {
      return res.status(400).json({ message: "Thiếu userId", issued: false });
    }

    const actingOnSelf = decoded.uid === targetUserId;
    if (!actingOnSelf) {
      const canManage = await canManageCourse(decoded.uid, courseId);
      if (!canManage) {
        return res.status(403).json({ message: "Không đủ quyền cấp chứng nhận.", issued: false });
      }
    }

    const db = admin.firestore();
    const enrollmentRef = db.doc(`enrollments/${targetUserId}_${courseId}`);
    const [courseSnap, enrollmentSnap] = await Promise.all([
      db.doc(`courses/${courseId}`).get(),
      enrollmentRef.get(),
    ]);

    if (!courseSnap.exists) {
      return res.status(404).json({ message: "Không tìm thấy khoá học.", issued: false });
    }
    if (!enrollmentSnap.exists) {
      return res.status(400).json({ message: "Học viên chưa ghi danh.", issued: false });
    }

    const course = courseSnap.data() as {
      access_model?: string | null;
      final_assignment_title?: string | null;
    };
    const enrollment = enrollmentSnap.data() as EnrollmentDoc & {
      certificate_issued_at?: string | null;
    };

    if (enrollment.certificate_issued_at) {
      return res.status(200).json({
        issued: true,
        certificate_issued_at: enrollment.certificate_issued_at,
      });
    }

    if (course.access_model === "free_with_paid_certificate") {
      const paymentSnap = await db
        .doc(`course_payment_access/${targetUserId}_${courseId}`)
        .get();
      const paid = paymentSnap.exists && paymentSnap.data()?.certificate_fee_paid === true;
      if (!paid) {
        return res.status(200).json({ issued: false });
      }
    }

    const [lessonsSnap, progressSnap] = await Promise.all([
      db.collection(`courses/${courseId}/lessons`).get(),
      db
        .collection("lesson_progress")
        .where("user_id", "==", targetUserId)
        .where("course_id", "==", courseId)
        .get(),
    ]);

    const lessons = lessonsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as LessonDoc[];
    if (lessons.length === 0) {
      return res.status(200).json({ issued: false });
    }

    const completedIds = new Set(
      progressSnap.docs
        .map((doc) => doc.data() as LessonProgressDoc)
        .filter((row) => !!row.completed_at)
        .map((row) => row.lesson_id),
    );

    if (completedIds.size < lessons.length) {
      return res.status(200).json({ issued: false });
    }

    if (course.final_assignment_title) {
      const submissionSnap = await db
        .collection("final_assignment_submissions")
        .where("user_id", "==", targetUserId)
        .where("course_id", "==", courseId)
        .limit(1)
        .get();
      const submission = submissionSnap.docs[0]?.data() as FinalAssignmentSubmissionDoc | undefined;
      if (!submission || submission.status !== "approved") {
        return res.status(200).json({ issued: false });
      }
    }

    const issuedAt = nowIso();
    await enrollmentRef.set({ certificate_issued_at: issuedAt }, { merge: true });
    return res.status(200).json({ issued: true, certificate_issued_at: issuedAt });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (/Authorization/i.test(message) || /Firebase ID token/i.test(message) || /App Check/i.test(message)) {
      return res.status(401).json({ message: "Chưa đăng nhập", issued: false });
    }
    logger.error("Issue certificate error", e);
    return res.status(500).json({ message: "Không thể cấp chứng nhận.", issued: false });
  }
}

app.post("/certificates/issue", handleIssueCertificate);
app.post("/api/certificates/issue", handleIssueCertificate);

app.post("/offline/meet/session/create-space", handleCreateOfflineSessionMeetSpace);
app.post("/api/offline/meet/session/create-space", handleCreateOfflineSessionMeetSpace);

async function handleVerifySePayPayment(req: express.Request, res: express.Response) {
  try {
    const decoded = await verifyFirebaseAuth(req);
    const body = (req.body ?? {}) as VerifyPaymentRequestBody;
    const explicitOrderId = String(body.orderId ?? "").trim();
    const courseId = String(body.courseId ?? "").trim();
    const purpose =
      body.purpose === "course_purchase" || body.purpose === "certificate_fee"
        ? body.purpose
        : undefined;

    let orderSnap:
      | FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>
      | null = null;

    if (explicitOrderId) {
      const snap = await admin.firestore().doc(`payment_transactions/${explicitOrderId}`).get();
      if (!snap.exists) {
        return res.status(404).json({ message: "Không tìm thấy giao dịch." });
      }
      orderSnap = snap;
    } else {
      if (!courseId || !purpose) {
        return res.status(400).json({ message: "Thiếu orderId hoặc cặp courseId/purpose." });
      }
      const snap = await admin
        .firestore()
        .collection("payment_transactions")
        .where("user_id", "==", decoded.uid)
        .where("course_id", "==", courseId)
        .where("purpose", "==", purpose)
        .limit(20)
        .get();

      if (snap.empty) {
        return res.status(404).json({ message: "Chưa có giao dịch nào phù hợp." });
      }

      const latestDoc = [...snap.docs].sort((a, b) =>
        String(b.data().created_at ?? "").localeCompare(String(a.data().created_at ?? "")),
      )[0];
      orderSnap = latestDoc ?? null;
    }

    if (!orderSnap?.exists) {
      return res.status(404).json({ message: "Không tìm thấy giao dịch." });
    }

    const tx = orderSnap.data() as PaymentTransaction;
    if (tx.user_id !== decoded.uid) {
      return res.status(403).json({ message: "Không có quyền xem giao dịch này." });
    }

    const accessId = `${tx.user_id}_${tx.course_id}`;
    const accessRef = admin.firestore().doc(`course_payment_access/${accessId}`);
    const enrollmentRef = admin.firestore().doc(`enrollments/${tx.user_id}_${tx.course_id}`);

    const [accessSnapBefore, enrollmentSnapBefore] = await Promise.all([
      accessRef.get(),
      enrollmentRef.get(),
    ]);

    const alreadyGranted =
      (tx.purpose === "course_purchase" &&
        accessSnapBefore.exists &&
        accessSnapBefore.data()?.full_access_granted === true) ||
      (tx.purpose === "certificate_fee" &&
        accessSnapBefore.exists &&
        accessSnapBefore.data()?.certificate_fee_paid === true);

    let verifiedBy: "transaction" | "sepay_lookup" | "pending" = "pending";

    if (tx.status === "paid" && !alreadyGranted) {
      await grantPaymentAccessForTransaction(tx, orderSnap.id, nowIso(), {
        source: "verify_endpoint_reconcile",
        original_provider_payload: tx.provider_payload ?? null,
      });
      verifiedBy = "transaction";
    } else if (tx.status === "paid") {
      verifiedBy = "transaction";
    } else {
      const sepayOrder = await fetchSePayOrderByInvoiceNumber(orderSnap.id, tx.user_id);
      if (sepayOrder?.order_status === "CAPTURED") {
        await grantPaymentAccessForTransaction(tx, orderSnap.id, nowIso(), {
          source: "verify_endpoint_sepay_lookup",
          sepay_order: sepayOrder,
        });
        verifiedBy = "sepay_lookup";
      }
    }

    const [freshTxSnap, accessSnap, enrollmentSnap] = await Promise.all([
      admin.firestore().doc(`payment_transactions/${orderSnap.id}`).get(),
      accessRef.get(),
      enrollmentRef.get(),
    ]);

    const freshTx = freshTxSnap.data() as PaymentTransaction | undefined;
    const access = accessSnap.exists ? accessSnap.data() : null;

    return res.status(200).json({
      order_id: orderSnap.id,
      status: freshTx?.status ?? tx.status,
      purpose: tx.purpose,
      course_id: tx.course_id,
      full_access_granted: access?.full_access_granted === true,
      certificate_fee_paid: access?.certificate_fee_paid === true,
      enrolled: enrollmentSnap.exists || enrollmentSnapBefore.exists,
      verified_by: verifiedBy,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (/Authorization/i.test(message) || /Firebase ID token/i.test(message) || /App Check/i.test(message)) {
      return res.status(401).json({ message: "Chưa đăng nhập" });
    }
    logger.error("Verify SePay payment error", e);
    return res.status(500).json({ message: "Không thể xác minh thanh toán lúc này." });
  }
}

app.post("/payments/sepay/verify", handleVerifySePayPayment);
app.post("/api/payments/sepay/verify", handleVerifySePayPayment);

async function handleSePayIpn(req: express.Request, res: express.Response) {
  try {
    const expected = process.env.SEPAY_IPN_SECRET ?? process.env.SEPAY_SECRET_KEY ?? "";
    if (!expected) throw new Error("Missing env: SEPAY_IPN_SECRET (or SEPAY_SECRET_KEY)");

    const got = req.header("x-secret-key") ?? req.header("X-Secret-Key") ?? "";
    if (!got || !timingSafeEqual(got, expected)) {
      return res.status(401).json({ message: "Invalid IPN secret" });
    }

    const payload = (req.body ?? {}) as SePayIpnPayload;
    const type = payload.notification_type;
    const invoiceNumber = payload.order?.order_invoice_number;
    const orderAmount = payload.order?.order_amount;

    if (!invoiceNumber || typeof invoiceNumber !== "string") {
      return res.status(400).json({ message: "Missing order_invoice_number" });
    }

    const orderRef = admin.firestore().doc(`payment_transactions/${invoiceNumber}`);
    const snap = await orderRef.get();
    if (!snap.exists) {
      logger.warn("IPN for unknown invoice", { invoiceNumber });
      // Still return 200 so SePay doesn't retry forever; you can investigate logs.
      return res.status(200).json({ ok: true });
    }

    const tx = snap.data() as PaymentTransaction;
    const updatedAt = nowIso();

    if (tx.status === "paid") {
      return res.status(200).json({ ok: true });
    }

    if (type === "ORDER_PAID") {
      const expectedAmount = Math.round(Number(tx.amount_vnd ?? 0));
      const paidAmount = Math.round(Number(orderAmount ?? 0));
      if (!Number.isFinite(paidAmount) || paidAmount <= 0 || paidAmount !== expectedAmount) {
        logger.error("IPN amount mismatch", {
          invoiceNumber,
          expectedAmount,
          paidAmount,
        });
        return res.status(400).json({ message: "Amount mismatch" });
      }

      await orderRef.set(
        {
          status: "paid",
          provider_payload: payload,
          updated_at: updatedAt,
        },
        { merge: true },
      );
      await grantPaymentAccessForTransaction(tx, invoiceNumber, updatedAt, payload);

      logger.info("IPN ORDER_PAID handled", {
        invoiceNumber,
        amount: orderAmount,
        userId: tx.user_id,
        courseId: tx.course_id,
        purpose: tx.purpose,
      });

      return res.status(200).json({ ok: true });
    }

    // For other notification types, just store payload for debugging.
    await orderRef.set(
      { provider_payload: payload, updated_at: updatedAt },
      { merge: true },
    );
    return res.status(200).json({ ok: true });
  } catch (e) {
    logger.error("SePay IPN error", e);
    return res.status(500).json({ ok: false });
  }
}

// Support both direct Cloud Run URL and Firebase Hosting rewrite (/api/**).
app.post("/payments/sepay/ipn", handleSePayIpn);
app.post("/api/payments/sepay/ipn", handleSePayIpn);

export const api = onRequest(
  {
    region: "asia-southeast1",
    invoker: "public",
    // Add env vars in Firebase Console/CLI; do not hardcode secrets here.
  },
  app,
);
