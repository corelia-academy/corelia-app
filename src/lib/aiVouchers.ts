import { coreliaEdgeUrl, supabaseFunctionHeaders } from "@/lib/coreliaEdgeApi";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export interface AiVoucherBatch {
  id: string;
  name: string;
  percent_off: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface AiVoucherCode {
  id: string;
  batch_id: string;
  code: string;
  active: boolean;
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

export interface AiVoucherBatchCreateInput {
  name: string;
  quantity: number;
  codePrefix?: string;
  percentOff: number;
  startsAt?: string | null;
  endsAt?: string | null;
  active: boolean;
}

export interface AiVoucherBatchCreateResult {
  batch: AiVoucherBatch;
  codes: AiVoucherCode[];
  csvText: string;
}

function rowToBatch(row: Record<string, unknown>): AiVoucherBatch {
  return {
    id: String(row.id),
    name: String(row.name),
    percent_off: Number(row.percent_off),
    active: Boolean(row.active),
    starts_at: (row.starts_at as string | null) ?? null,
    ends_at: (row.ends_at as string | null) ?? null,
    created_at: String(row.created_at),
    created_by: (row.created_by as string | null) ?? null,
    updated_at: String(row.updated_at),
    updated_by: (row.updated_by as string | null) ?? null,
  };
}

function rowToCode(row: Record<string, unknown>): AiVoucherCode {
  return {
    id: String(row.id),
    batch_id: String(row.batch_id),
    code: String(row.code),
    active: Boolean(row.active),
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

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function requireViewer(viewer?: User | null) {
  const user = viewer ?? (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Chưa đăng nhập");
  return user;
}

export async function listAiVoucherBatches(): Promise<AiVoucherBatch[]> {
  const { data, error } = await supabase
    .from("ai_voucher_batches")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToBatch(row as Record<string, unknown>));
}

export async function listAiVoucherCodes(batchId: string): Promise<AiVoucherCode[]> {
  const { data, error } = await supabase
    .from("ai_vouchers")
    .select("*")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToCode(row as Record<string, unknown>));
}

export async function listAiVoucherRedemptions(): Promise<AiVoucherRedemption[]> {
  const { data, error } = await supabase
    .from("ai_voucher_redemptions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToRedemption(row as Record<string, unknown>));
}

export async function createAiVoucherBatch(input: AiVoucherBatchCreateInput): Promise<AiVoucherBatchCreateResult> {
  const endpoint = coreliaEdgeUrl("payments.ai.vouchers.batchCreate");
  const token = await getAccessToken();
  if (!endpoint || !token) throw new Error("Phiên đăng nhập không hợp lệ.");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...supabaseFunctionHeaders(token),
    },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<{
    batch: AiVoucherBatch;
    codes: AiVoucherCode[];
    csvText: string;
    message: string;
  }>;
  if (!res.ok || !data.batch || !Array.isArray(data.codes) || typeof data.csvText !== "string") {
    throw new Error(data.message || "Không tạo được batch voucher.");
  }
  return { batch: data.batch, codes: data.codes, csvText: data.csvText };
}

export async function updateAiVoucherBatch(
  batchId: string,
  patch: {
    name?: string;
    percent_off?: number;
    starts_at?: string | null;
    ends_at?: string | null;
    active?: boolean;
  },
  viewer?: User | null,
): Promise<AiVoucherBatch> {
  const user = await requireViewer(viewer);
  const { data, error } = await supabase
    .from("ai_voucher_batches")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", batchId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToBatch(data as Record<string, unknown>);
}

export async function setAiVoucherCodeActive(
  voucherId: string,
  active: boolean,
  viewer?: User | null,
): Promise<void> {
  const user = await requireViewer(viewer);
  const { error } = await supabase
    .from("ai_vouchers")
    .update({
      active,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", voucherId);
  if (error) throw new Error(error.message);
}
