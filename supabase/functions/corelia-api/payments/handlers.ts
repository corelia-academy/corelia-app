import { getUserRole, isAuthFailure } from "../lib/authz.ts";
import { randomHex, timingSafeEqual } from "../lib/crypto.ts";
import { requireEnv } from "../lib/env.ts";
import { json, nowIso } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { isValidPaymentCallbackUrl, paymentCallbackOriginAllowlistFromEnv } from "./callback_url.ts";
import { grantPaymentAccessForTransaction } from "./grant_access.ts";
import {
  buildSePaySignature,
  fetchSePayIncomingTransactionByInvoiceNumber,
  sepayCheckoutInitUrl,
} from "./sepay.ts";
import {
  previewAiVoucher,
  releaseVoucherReservationForPayment,
  reserveAiVoucherForPayment,
} from "./vouchers.ts";
import type {
  AiSubscriptionDurationMonths,
  AiSubscriptionMeta,
  AiSubscriptionTier,
  PaymentPurpose,
  PaymentTransaction,
  SePayIpnPayload,
} from "./types.ts";

const AI_SUBSCRIPTION_PRODUCT_ID = "cora-ai";

const AI_SUBSCRIPTION_PRICES: Record<
  AiSubscriptionTier,
  Record<AiSubscriptionDurationMonths, number>
> = {
  student: { 1: 99000, 6: 499000, 12: 890000 },
  pro: { 1: 199000, 6: 999000, 12: 1790000 },
  bootcamp: { 1: 499000, 6: 2490000, 12: 4490000 },
};

export async function handleSePayCheckout(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const purpose = body.purpose === "course_purchase" || body.purpose === "certificate_fee" || body.purpose === "ai_subscription"
      ? body.purpose as PaymentPurpose
      : null;
    const courseId = purpose === "ai_subscription"
      ? AI_SUBSCRIPTION_PRODUCT_ID
      : String(body.courseId ?? "");
    const requestedAmountVnd = Number(body.amountVnd ?? 0);
    const successUrl = String(body.successUrl ?? "");
    const errorUrl = String(body.errorUrl ?? "");
    const cancelUrl = String(body.cancelUrl ?? "");
    const discountCodeRaw = String(body.discountCode ?? "").trim();
    const voucherCodeRaw = String(body.voucherCode ?? "").trim();
    if (!courseId) return json({ message: "Thiếu courseId" }, 400);
    if (!purpose) return json({ message: "Thiếu/ sai purpose" }, 400);
    if (purpose !== "ai_subscription" && (!Number.isFinite(requestedAmountVnd) || requestedAmountVnd <= 0)) {
      return json({ message: "amountVnd không hợp lệ" }, 400);
    }
    const callbackAllowlist = paymentCallbackOriginAllowlistFromEnv();
    if (
      !isValidPaymentCallbackUrl(successUrl, callbackAllowlist) ||
      !isValidPaymentCallbackUrl(errorUrl, callbackAllowlist) ||
      !isValidPaymentCallbackUrl(cancelUrl, callbackAllowlist)
    ) {
      return json({ message: "Callback URLs không hợp lệ" }, 400);
    }
    const merchantId = requireEnv("SEPAY_MERCHANT_ID");
    const secretKey = requireEnv("SEPAY_SECRET_KEY");
    let baseAmount = 0;
    let subscriptionMeta: AiSubscriptionMeta | null = null;
    if (purpose === "ai_subscription") {
      const tier = String(body.tier ?? "").trim() as AiSubscriptionTier;
      const durationMonths = Number(body.durationMonths ?? body.duration_months ?? 0) as AiSubscriptionDurationMonths;
      if (!["student", "pro", "bootcamp"].includes(tier)) {
        return json({ message: "Tier không hợp lệ" }, 400);
      }
      if (![1, 6, 12].includes(durationMonths)) {
        return json({ message: "Thời hạn không hợp lệ" }, 400);
      }
      const now = new Date().toISOString();
      const { data: activeSubscription, error: activeSubscriptionError } = await db
        .from("ai_subscriptions")
        .select("tier,expires_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gt("expires_at", now)
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ tier: AiSubscriptionTier; expires_at: string }>();
      if (activeSubscriptionError) throw new Error(activeSubscriptionError.message);
      if (activeSubscription?.tier && activeSubscription.tier !== tier) {
        return json({ message: "Khi gói hiện tại còn hiệu lực, bạn chỉ có thể gia hạn cùng tier." }, 400);
      }
      baseAmount = AI_SUBSCRIPTION_PRICES[tier][durationMonths];
      subscriptionMeta = { tier, duration_months: durationMonths };
    } else {
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
      baseAmount = purpose === "course_purchase"
        ? (promoActive ? promoPrice : basePrice)
        : Math.round(Number(course.certificate_fee_vnd ?? 0));
    }
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      return json({ message: purpose === "ai_subscription" ? "Gói AI chưa cấu hình giá hợp lệ" : "Khoá học chưa cấu hình phí hợp lệ" }, 400);
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
    } else if (purpose === "ai_subscription" && voucherCodeRaw) {
      const voucher = await previewAiVoucher(db, {
        userId: user.id,
        voucherCode: voucherCodeRaw,
        baseAmountVnd: baseAmount,
      });
      discountCode = voucher.code;
      discountAmount = voucher.discountAmountVnd;
      finalAmount = voucher.finalAmountVnd;
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
      provider_payload: subscriptionMeta ? { subscription_meta: subscriptionMeta } : undefined,
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
      provider_payload: subscriptionMeta ? { subscription_meta: subscriptionMeta } : undefined,
      created_at: createdAt,
      updated_at: createdAt,
    });
    if (insErr) throw new Error(insErr.message);
    if (purpose === "ai_subscription" && discountCode) {
      await reserveAiVoucherForPayment(db, {
        userId: user.id,
        paymentTransactionId: orderId,
        voucherCode: discountCode,
        baseAmountVnd: baseAmount,
      });
    }
    const fields: Record<string, string> = {
      merchant: merchantId,
      operation: "PURCHASE",
      payment_method: "BANK_TRANSFER",
      order_amount: String(Math.round(finalAmount)),
      currency: "VND",
      order_invoice_number: orderId,
      order_description: purpose === "course_purchase"
        ? `Thanh toán khoá học ${courseId}`
        : purpose === "certificate_fee"
          ? `Thanh toán phí chứng nhận ${courseId}`
          : `Thanh toán gói Cora AI ${subscriptionMeta?.tier ?? ""} ${subscriptionMeta?.duration_months ?? ""} tháng`,
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

export async function handleAiVoucherPreview(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const tier = String(body.tier ?? "").trim() as AiSubscriptionTier;
    const durationMonths = Number(body.durationMonths ?? body.duration_months ?? 0) as AiSubscriptionDurationMonths;
    const voucherCode = String(body.voucherCode ?? "").trim();

    if (!["student", "pro", "bootcamp"].includes(tier)) {
      return json({ message: "Tier không hợp lệ" }, 400);
    }
    if (![1, 6, 12].includes(durationMonths)) {
      return json({ message: "Thời hạn không hợp lệ" }, 400);
    }
    if (!voucherCode) return json({ message: "Thiếu mã voucher." }, 400);

    const preview = await previewAiVoucher(db, {
      userId: user.id,
      voucherCode,
      baseAmountVnd: AI_SUBSCRIPTION_PRICES[tier][durationMonths],
    });
    return json({
      code: preview.code,
      percent_off: preview.percentOff,
      base_amount_vnd: preview.baseAmountVnd,
      discount_amount_vnd: preview.discountAmountVnd,
      final_amount_vnd: preview.finalAmountVnd,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập" }, 401);
    return json({ message }, 400);
  }
}

export async function handleMyPaymentTransactions(req: Request, db: SupabaseClient): Promise<Response> {
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

export async function handleVerifySePayPayment(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const explicitOrderId = String(body.orderId ?? "").trim();
    const courseId = String(body.courseId ?? "").trim();
    const purpose = body.purpose === "course_purchase" || body.purpose === "certificate_fee" || body.purpose === "ai_subscription"
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
      (tx.purpose === "certificate_fee" && accessBefore?.certificate_fee_paid === true) ||
      (tx.purpose === "ai_subscription" && tx.status === "paid");
    let verifiedBy: "transaction" | "sepay_lookup" | "pending" = "pending";
    if (tx.status === "paid" && !alreadyGranted) {
      await grantPaymentAccessForTransaction(db, tx, orderRow.id, nowIso(), {
        source: "verify_endpoint_reconcile",
        original_provider_payload: tx.provider_payload ?? null,
      });
      verifiedBy = "transaction";
    } else if (tx.status === "paid") verifiedBy = "transaction";
    else {
      const expectedAmount = Math.round(Number(tx.amount_vnd ?? 0));
      const sepayTx = await fetchSePayIncomingTransactionByInvoiceNumber(orderRow.id, expectedAmount);
      if (sepayTx) {
        await grantPaymentAccessForTransaction(db, tx, orderRow.id, nowIso(), {
          source: "verify_endpoint_sepay_lookup",
          sepay_transaction: sepayTx,
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
      enrolled: tx.purpose === "ai_subscription" ? false : (!!enrollment || !!enrollmentBefore),
      verified_by: verifiedBy,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập" }, 401);
    console.error("[corelia-api] verify", e);
    return json({ message: "Không thể xác minh thanh toán lúc này." }, 500);
  }
}

export async function handleSePayDebugLookup(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const role = await getUserRole(db, user.id);
    if (role !== "admin" && role !== "support_staff") {
      return json({ message: "Không đủ quyền." }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const invoiceNumber = String(body.orderId ?? body.invoiceNumber ?? "").trim();
    const expectedAmountVnd = Math.round(Number(body.amountVnd ?? body.expectedAmountVnd ?? 0));
    if (!invoiceNumber) return json({ message: "Thiếu orderId/invoiceNumber." }, 400);
    if (!Number.isFinite(expectedAmountVnd) || expectedAmountVnd <= 0) {
      return json({ message: "Thiếu amountVnd hợp lệ." }, 400);
    }

    const tx = await fetchSePayIncomingTransactionByInvoiceNumber(invoiceNumber, expectedAmountVnd);
    if (!tx) {
      return json({
        ok: true,
        found: false,
        invoice_number: invoiceNumber,
        expected_amount_vnd: expectedAmountVnd,
      });
    }
    return json({
      ok: true,
      found: true,
      invoice_number: invoiceNumber,
      expected_amount_vnd: expectedAmountVnd,
      transaction: {
        id: tx.id ?? null,
        transaction_date: tx.transaction_date ?? null,
        amount_in: tx.amount_in ?? null,
        transfer_type: tx.transfer_type ?? null,
        reference_number: tx.reference_number ?? null,
        code: tx.code ?? null,
        transaction_content: tx.transaction_content ?? null,
        bank_account_id: tx.bank_account_id ?? null,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập" }, 401);
    console.error("[corelia-api] sepay.debugLookup", e);
    return json({ message: "Không thể debug lookup SePay." }, 500);
  }
}

export async function handleSePayIpn(req: Request, db: SupabaseClient): Promise<Response> {
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
      const { error: txUpdateErr } = await db.from("payment_transactions").update({
        status: "paid",
        provider_payload: payload as unknown as Record<string, unknown>,
        updated_at: updatedAt,
      }).eq("id", invoiceNumber);
      if (txUpdateErr) throw new Error(txUpdateErr.message);
      await grantPaymentAccessForTransaction(db, tx, invoiceNumber, updatedAt, payload);
      return json({ ok: true });
    }
    if (type === "ORDER_CANCELLED" || type === "ORDER_FAILED") {
      const nextStatus = type === "ORDER_CANCELLED" ? "cancelled" : "failed";
      const { error: statusErr } = await db.from("payment_transactions").update({
        status: nextStatus,
        provider_payload: payload as unknown as Record<string, unknown>,
        updated_at: updatedAt,
      }).eq("id", invoiceNumber);
      if (statusErr) throw new Error(statusErr.message);
      await releaseVoucherReservationForPayment(db, invoiceNumber);
      return json({ ok: true });
    }
    const { error: payloadUpdateErr } = await db.from("payment_transactions").update({
      provider_payload: payload as unknown as Record<string, unknown>,
      updated_at: updatedAt,
    }).eq("id", invoiceNumber);
    if (payloadUpdateErr) throw new Error(payloadUpdateErr.message);
    return json({ ok: true });
  } catch (e) {
    console.error("[corelia-api] IPN", e);
    return json({ ok: false }, 500);
  }
}
