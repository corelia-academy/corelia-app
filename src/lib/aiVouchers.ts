import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export interface AiVoucher {
  id: string;
  code: string;
  percent_off: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface AiVoucherRedemption {
  id: string;
  voucher_id: string;
  user_id: string;
  payment_transaction_id: string;
  status: "reserved" | "paid" | "released";
  base_amount_vnd: number;
  discount_amount_vnd: number;
  final_amount_vnd: number;
  reserved_until: string | null;
  paid_at: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiVoucherInput {
  code: string;
  percent_off: number;
  active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  max_redemptions?: number | null;
}

const CODE_RE = /^[A-Z0-9_-]{4,32}$/;

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function assertCode(code: string) {
  if (!CODE_RE.test(code)) throw new Error("Mã voucher không hợp lệ.");
}

function rowToVoucher(row: Record<string, unknown>): AiVoucher {
  return {
    id: String(row.id),
    code: String(row.code),
    percent_off: Number(row.percent_off),
    active: Boolean(row.active),
    starts_at: (row.starts_at as string | null) ?? null,
    ends_at: (row.ends_at as string | null) ?? null,
    max_redemptions: row.max_redemptions == null ? null : Number(row.max_redemptions),
    created_at: String(row.created_at),
    created_by: (row.created_by as string | null) ?? null,
    updated_at: String(row.updated_at),
    updated_by: (row.updated_by as string | null) ?? null,
  };
}

function rowToRedemption(row: Record<string, unknown>): AiVoucherRedemption {
  return {
    id: String(row.id),
    voucher_id: String(row.voucher_id),
    user_id: String(row.user_id),
    payment_transaction_id: String(row.payment_transaction_id),
    status: row.status as AiVoucherRedemption["status"],
    base_amount_vnd: Number(row.base_amount_vnd),
    discount_amount_vnd: Number(row.discount_amount_vnd),
    final_amount_vnd: Number(row.final_amount_vnd),
    reserved_until: (row.reserved_until as string | null) ?? null,
    paid_at: (row.paid_at as string | null) ?? null,
    released_at: (row.released_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function requireViewer(viewer?: User | null) {
  const user = viewer ?? (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Chưa đăng nhập");
  return user;
}

export async function listAiVouchers(): Promise<AiVoucher[]> {
  const { data, error } = await supabase
    .from("ai_vouchers")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToVoucher(row as Record<string, unknown>));
}

export async function listAiVoucherRedemptions(): Promise<AiVoucherRedemption[]> {
  const { data, error } = await supabase
    .from("ai_voucher_redemptions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToRedemption(row as Record<string, unknown>));
}

export async function upsertAiVoucher(
  input: AiVoucherInput,
  voucherId?: string | null,
  viewer?: User | null,
): Promise<AiVoucher> {
  const user = await requireViewer(viewer);
  const now = new Date().toISOString();
  const code = normalizeCode(input.code);
  assertCode(code);
  const payload = {
    code,
    percent_off: Math.round(Number(input.percent_off)),
    active: Boolean(input.active),
    starts_at: input.starts_at ?? null,
    ends_at: input.ends_at ?? null,
    max_redemptions: input.max_redemptions == null ? null : Math.round(Number(input.max_redemptions)),
    updated_at: now,
    updated_by: user.id,
  };
  if (payload.percent_off < 1 || payload.percent_off > 100) {
    throw new Error("Phần trăm giảm giá phải từ 1 đến 100.");
  }

  if (voucherId) {
    const { data, error } = await supabase
      .from("ai_vouchers")
      .update(payload)
      .eq("id", voucherId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToVoucher(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("ai_vouchers")
    .insert({
      id: crypto.randomUUID(),
      ...payload,
      created_at: now,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToVoucher(data as Record<string, unknown>);
}
