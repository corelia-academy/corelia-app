import { nowIso } from "../lib/http.ts";
import type { SupabaseClient } from "../lib/supabase.ts";

const VOUCHER_CODE_RE = /^[A-Z0-9_-]{4,32}$/;
const RESERVATION_TTL_MS = 30 * 60 * 1000;

type AiVoucherRow = {
  id: string;
  code: string;
  percent_off: number;
  active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  max_redemptions?: number | null;
};

export type AiVoucherPreview = {
  voucherId: string;
  code: string;
  percentOff: number;
  baseAmountVnd: number;
  discountAmountVnd: number;
  finalAmountVnd: number;
};

function parseTime(value?: string | null): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

export function normalizeVoucherCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function assertVoucherCode(code: string) {
  if (!VOUCHER_CODE_RE.test(code)) {
    throw new Error("Mã voucher không hợp lệ.");
  }
}

function computeDiscount(baseAmountVnd: number, percentOff: number) {
  const discountAmountVnd = Math.max(
    0,
    Math.min(baseAmountVnd, Math.round((baseAmountVnd * percentOff) / 100)),
  );
  return {
    discountAmountVnd,
    finalAmountVnd: Math.max(0, baseAmountVnd - discountAmountVnd),
  };
}

async function loadVoucherByCode(db: SupabaseClient, normalizedCode: string): Promise<AiVoucherRow> {
  const { data, error } = await db
    .from("ai_vouchers")
    .select("id,code,percent_off,active,starts_at,ends_at,max_redemptions")
    .eq("code", normalizedCode)
    .maybeSingle<AiVoucherRow>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Voucher không tồn tại.");
  return data;
}

async function countActiveReservationsAndPaid(db: SupabaseClient, voucherId: string, now: string): Promise<number> {
  const [{ count: paidCount, error: paidError }, { count: reservedCount, error: reservedError }] = await Promise.all([
    db
      .from("ai_voucher_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("voucher_id", voucherId)
      .eq("status", "paid"),
    db
      .from("ai_voucher_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("voucher_id", voucherId)
      .eq("status", "reserved")
      .gt("reserved_until", now),
  ]);
  if (paidError) throw new Error(paidError.message);
  if (reservedError) throw new Error(reservedError.message);
  return Number(paidCount ?? 0) + Number(reservedCount ?? 0);
}

async function hasPaidRedemption(db: SupabaseClient, voucherId: string, userId: string): Promise<boolean> {
  const { data, error } = await db
    .from("ai_voucher_redemptions")
    .select("id")
    .eq("voucher_id", voucherId)
    .eq("user_id", userId)
    .eq("status", "paid")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(error.message);
  return !!data?.id;
}

export async function previewAiVoucher(
  db: SupabaseClient,
  params: { userId: string; voucherCode: string; baseAmountVnd: number },
): Promise<AiVoucherPreview> {
  const normalizedCode = normalizeVoucherCode(params.voucherCode);
  assertVoucherCode(normalizedCode);
  if (!Number.isFinite(params.baseAmountVnd) || params.baseAmountVnd <= 0) {
    throw new Error("Giá gói không hợp lệ.");
  }

  const voucher = await loadVoucherByCode(db, normalizedCode);
  const now = Date.now();
  const startsAt = parseTime(voucher.starts_at);
  const endsAt = parseTime(voucher.ends_at);

  if (!voucher.active) throw new Error("Voucher hiện đang bị tắt.");
  if (startsAt != null && startsAt > now) throw new Error("Voucher chưa đến thời gian áp dụng.");
  if (endsAt != null && endsAt < now) throw new Error("Voucher đã hết hạn.");
  if (await hasPaidRedemption(db, voucher.id, params.userId)) {
    throw new Error("Bạn đã dùng voucher này rồi.");
  }

  if (voucher.max_redemptions != null) {
    const inUse = await countActiveReservationsAndPaid(db, voucher.id, new Date(now).toISOString());
    if (inUse >= Number(voucher.max_redemptions)) {
      throw new Error("Voucher đã hết lượt sử dụng.");
    }
  }

  const { discountAmountVnd, finalAmountVnd } = computeDiscount(
    Math.round(params.baseAmountVnd),
    Math.round(Number(voucher.percent_off ?? 0)),
  );

  return {
    voucherId: voucher.id,
    code: voucher.code,
    percentOff: Math.round(Number(voucher.percent_off ?? 0)),
    baseAmountVnd: Math.round(params.baseAmountVnd),
    discountAmountVnd,
    finalAmountVnd,
  };
}

export async function reserveAiVoucherForPayment(
  db: SupabaseClient,
  params: {
    userId: string;
    paymentTransactionId: string;
    voucherCode: string;
    baseAmountVnd: number;
  },
): Promise<AiVoucherPreview> {
  const preview = await previewAiVoucher(db, {
    userId: params.userId,
    voucherCode: params.voucherCode,
    baseAmountVnd: params.baseAmountVnd,
  });
  const now = new Date();
  const reservedUntil = new Date(now.getTime() + RESERVATION_TTL_MS).toISOString();
  const updatedAt = now.toISOString();

  const { error } = await db.from("ai_voucher_redemptions").upsert(
    {
      voucher_id: preview.voucherId,
      user_id: params.userId,
      payment_transaction_id: params.paymentTransactionId,
      status: "reserved",
      base_amount_vnd: preview.baseAmountVnd,
      discount_amount_vnd: preview.discountAmountVnd,
      final_amount_vnd: preview.finalAmountVnd,
      reserved_until: reservedUntil,
      paid_at: null,
      released_at: null,
      updated_at: updatedAt,
    },
    { onConflict: "payment_transaction_id" },
  );
  if (error) throw new Error(error.message);

  return preview;
}

export async function markVoucherPaidForPayment(
  db: SupabaseClient,
  paymentTransactionId: string,
  paidAt: string,
): Promise<void> {
  const { error } = await db
    .from("ai_voucher_redemptions")
    .update({
      status: "paid",
      paid_at: paidAt,
      reserved_until: null,
      released_at: null,
      updated_at: paidAt,
    })
    .eq("payment_transaction_id", paymentTransactionId);
  if (error) throw new Error(error.message);
}

export async function releaseVoucherReservationForPayment(
  db: SupabaseClient,
  paymentTransactionId: string,
): Promise<void> {
  const releasedAt = nowIso();
  const { error } = await db
    .from("ai_voucher_redemptions")
    .update({
      status: "released",
      released_at: releasedAt,
      reserved_until: null,
      updated_at: releasedAt,
    })
    .eq("payment_transaction_id", paymentTransactionId)
    .eq("status", "reserved");
  if (error) throw new Error(error.message);
}
