import { randomAlphanumeric } from "../lib/crypto.ts";
import { getUserRole } from "../lib/authz.ts";
import { nowIso } from "../lib/http.ts";
import type { SupabaseClient } from "../lib/supabase.ts";

const VOUCHER_CODE_RE = /^[A-Z0-9_-]{4,32}$/;
const CODE_PREFIX_RE = /^[A-Z0-9]{0,12}$/;
const RESERVATION_TTL_MS = 30 * 60 * 1000;

type AiVoucherBatchRow = {
  id: string;
  name: string;
  percent_off: number;
  active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  target_tier?: string | null;
  target_duration_months?: number | null;
};

type AiVoucherCodeRow = {
  id: string;
  batch_id: string;
  code: string;
  active: boolean;
};

export type AiVoucherPreview = {
  voucherId: string;
  code: string;
  percentOff: number;
  baseAmountVnd: number;
  discountAmountVnd: number;
  finalAmountVnd: number;
};

export type BatchCreateInput = {
  userId: string;
  name: string;
  quantity: number;
  codePrefix?: string;
  percentOff: number;
  startsAt?: string | null;
  endsAt?: string | null;
  active: boolean;
  targetTier?: string | null;
  targetDurationMonths?: number | null;
};

export type BatchCreateResult = {
  batch: AiVoucherBatchRow;
  codes: AiVoucherCodeRow[];
  csvText: string;
};

function parseTime(value?: string | null): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

export function normalizeVoucherCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function normalizePrefix(raw?: string | null): string {
  return String(raw ?? "").trim().toUpperCase();
}

function assertVoucherCode(code: string) {
  if (!VOUCHER_CODE_RE.test(code)) throw new Error("Mã voucher không hợp lệ.");
}

const VALID_TIERS = ["student", "pro", "bootcamp"] as const;
const VALID_DURATIONS = [1, 12] as const;

function assertBatchInput(input: BatchCreateInput) {
  if (!input.name.trim()) throw new Error("Thiếu tên batch.");
  if (!Number.isInteger(input.quantity) || input.quantity <= 0 || input.quantity > 1000) {
    throw new Error("Số lượng mã phải từ 1 đến 1000.");
  }
  if (!Number.isInteger(input.percentOff) || input.percentOff < 1 || input.percentOff > 100) {
    throw new Error("Phần trăm giảm giá phải từ 1 đến 100.");
  }
  const prefix = normalizePrefix(input.codePrefix);
  if (!CODE_PREFIX_RE.test(prefix)) throw new Error("Prefix mã không hợp lệ.");
  const startsAt = parseTime(input.startsAt);
  const endsAt = parseTime(input.endsAt);
  if (startsAt != null && endsAt != null && startsAt > endsAt) {
    throw new Error("Thời gian bắt đầu phải trước thời gian kết thúc.");
  }
  if (input.targetTier != null && !(VALID_TIERS as readonly string[]).includes(input.targetTier)) {
    throw new Error("Tier mục tiêu không hợp lệ.");
  }
  if (input.targetDurationMonths != null && !(VALID_DURATIONS as readonly number[]).includes(input.targetDurationMonths)) {
    throw new Error("Thời hạn mục tiêu không hợp lệ.");
  }
}

function buildVoucherCode(prefix = "") {
  const suffix = randomAlphanumeric(8);
  return prefix ? `${prefix}-${suffix}` : suffix;
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

async function loadVoucherByCode(
  db: SupabaseClient,
  normalizedCode: string,
): Promise<{ voucher: AiVoucherCodeRow; batch: AiVoucherBatchRow }> {
  const { data, error } = await db
    .from("ai_vouchers")
    .select(`
      id,
      batch_id,
      code,
      active,
      ai_voucher_batches!inner (
        id,
        name,
        percent_off,
        active,
        starts_at,
        ends_at,
        target_tier,
        target_duration_months
      )
    `)
    .eq("code", normalizedCode)
    .maybeSingle<{
      id: string;
      batch_id: string;
      code: string;
      active: boolean;
      ai_voucher_batches: AiVoucherBatchRow;
    }>();
  if (error) throw new Error(error.message);
  if (!data?.ai_voucher_batches) throw new Error("Voucher không tồn tại.");
  return {
    voucher: {
      id: data.id,
      batch_id: data.batch_id,
      code: data.code,
      active: data.active,
    },
    batch: data.ai_voucher_batches,
  };
}

async function countVoucherRedemptions(
  db: SupabaseClient,
  voucherId: string,
  now: string,
): Promise<{ paid: number; reserved: number }> {
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
  return {
    paid: Number(paidCount ?? 0),
    reserved: Number(reservedCount ?? 0),
  };
}

export async function previewAiVoucher(
  db: SupabaseClient,
  params: {
    voucherCode: string;
    baseAmountVnd: number;
    tier?: string | null;
    durationMonths?: number | null;
  },
): Promise<AiVoucherPreview> {
  const normalizedCode = normalizeVoucherCode(params.voucherCode);
  assertVoucherCode(normalizedCode);
  if (!Number.isFinite(params.baseAmountVnd) || params.baseAmountVnd <= 0) {
    throw new Error("Giá gói không hợp lệ.");
  }

  const { voucher, batch } = await loadVoucherByCode(db, normalizedCode);
  const now = Date.now();
  const startsAt = parseTime(batch.starts_at);
  const endsAt = parseTime(batch.ends_at);

  if (!voucher.active) throw new Error("Mã voucher hiện đang bị tắt.");
  if (!batch.active) throw new Error("Batch voucher hiện đang bị tắt.");
  if (startsAt != null && startsAt > now) throw new Error("Voucher chưa đến thời gian áp dụng.");
  if (endsAt != null && endsAt < now) throw new Error("Voucher đã hết hạn.");

  const counts = await countVoucherRedemptions(db, voucher.id, new Date(now).toISOString());
  if (counts.paid > 0) throw new Error("Voucher này đã được sử dụng.");
  if (counts.reserved > 0) throw new Error("Voucher này đang được giữ chỗ cho checkout khác.");

  if (params.tier != null && batch.target_tier != null && params.tier !== batch.target_tier) {
    throw new Error("Voucher này chỉ áp dụng cho gói " + batch.target_tier + ".");
  }
  if (params.durationMonths != null && batch.target_duration_months != null && params.durationMonths !== batch.target_duration_months) {
    throw new Error("Voucher này chỉ áp dụng cho thời hạn " + batch.target_duration_months + " tháng.");
  }

  const { discountAmountVnd, finalAmountVnd } = computeDiscount(
    Math.round(params.baseAmountVnd),
    Math.round(Number(batch.percent_off ?? 0)),
  );

  return {
    voucherId: voucher.id,
    code: voucher.code,
    percentOff: Math.round(Number(batch.percent_off ?? 0)),
    baseAmountVnd: Math.round(params.baseAmountVnd),
    discountAmountVnd,
    finalAmountVnd,
  };
}

export async function reserveAiVoucherForPayment(
  db: SupabaseClient,
  params: {
    paymentTransactionId: string;
    voucherCode: string;
    userId: string;
    baseAmountVnd: number;
  },
): Promise<AiVoucherPreview> {
  const preview = await previewAiVoucher(db, {
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

export async function deleteAiVoucherBatch(
  db: SupabaseClient,
  batchId: string,
  userId: string,
): Promise<void> {
  const role = await getUserRole(db, userId);
  if (role !== "admin" && role !== "support_staff") {
    throw new Error("Không đủ quyền xóa batch voucher.");
  }

  const { data: voucherRows, error: voucherFetchError } = await db
    .from("ai_vouchers")
    .select("id")
    .eq("batch_id", batchId);
  if (voucherFetchError) throw new Error(voucherFetchError.message);

  const ids = (voucherRows ?? []).map((v) => (v as { id: string }).id);
  if (ids.length > 0) {
    const { count, error: redemptionCheckError } = await db
      .from("ai_voucher_redemptions")
      .select("id", { count: "exact", head: true })
      .in("voucher_id", ids)
      .eq("status", "paid");
    if (redemptionCheckError) throw new Error(redemptionCheckError.message);
    if ((count ?? 0) > 0) {
      throw new Error("Không thể xóa batch đã có voucher được sử dụng.");
    }

    const { error: deleteCodesError } = await db
      .from("ai_vouchers")
      .delete()
      .eq("batch_id", batchId);
    if (deleteCodesError) throw new Error(deleteCodesError.message);
  }

  const { error: deleteBatchError } = await db
    .from("ai_voucher_batches")
    .delete()
    .eq("id", batchId);
  if (deleteBatchError) throw new Error(deleteBatchError.message);
}

export function buildVoucherCsv(codes: AiVoucherCodeRow[]): string {
  return ["code", ...codes.map((code) => code.code)].join("\n");
}

export async function createAiVoucherBatch(
  db: SupabaseClient,
  input: BatchCreateInput,
): Promise<BatchCreateResult> {
  assertBatchInput(input);
  const role = await getUserRole(db, input.userId);
  if (role !== "admin" && role !== "support_staff") {
    throw new Error("Không đủ quyền tạo batch voucher.");
  }

  const now = nowIso();
  const prefix = normalizePrefix(input.codePrefix);
  const { data: batchData, error: batchError } = await db
    .from("ai_voucher_batches")
    .insert({
      name: input.name.trim(),
      percent_off: input.percentOff,
      active: input.active,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      target_tier: input.targetTier ?? null,
      target_duration_months: input.targetDurationMonths ?? null,
      created_at: now,
      created_by: input.userId,
      updated_at: now,
      updated_by: input.userId,
    })
    .select("id,name,percent_off,active,starts_at,ends_at,target_tier,target_duration_months")
    .single<AiVoucherBatchRow>();
  if (batchError || !batchData) throw new Error(batchError?.message ?? "Không tạo được batch voucher.");

  const generated = new Map<string, boolean>();
  const rows: Array<Record<string, unknown>> = [];
  while (rows.length < input.quantity) {
    const code = buildVoucherCode(prefix);
    if (generated.has(code)) continue;
    generated.set(code, true);
    rows.push({
      batch_id: batchData.id,
      code,
      percent_off: input.percentOff,
      active: input.active,
      created_at: now,
      created_by: input.userId,
      updated_at: now,
      updated_by: input.userId,
    });
  }

  const { data: insertedCodes, error: codeError } = await db
    .from("ai_vouchers")
    .insert(rows)
    .select("id,batch_id,code,active");
  if (codeError) throw new Error(codeError.message);

  const codes = (insertedCodes ?? []) as AiVoucherCodeRow[];
  return {
    batch: batchData,
    codes,
    csvText: buildVoucherCsv(codes),
  };
}
