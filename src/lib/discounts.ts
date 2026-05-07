import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export type CourseDiscountType = "percent" | "amount_vnd";

export interface CourseDiscount {
  id: string;
  course_id: string;
  code: string;
  type: CourseDiscountType;
  value: number;
  active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  max_redemptions?: number | null;
  redeemed_count?: number;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface CourseDiscountInsert {
  code: string;
  type: CourseDiscountType;
  value: number;
  active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  max_redemptions?: number | null;
}

function normalizeDiscountCode(code: string) {
  return code.trim().toUpperCase();
}

function rowToDiscount(row: Record<string, unknown>): CourseDiscount {
  return {
    id: String(row.id),
    course_id: String(row.course_id),
    code: String(row.code),
    type: row.type as CourseDiscountType,
    value: Number(row.value),
    active: Boolean(row.active),
    starts_at: (row.starts_at as string | null) ?? null,
    ends_at: (row.ends_at as string | null) ?? null,
    max_redemptions: row.max_redemptions != null ? Number(row.max_redemptions) : null,
    redeemed_count: row.redeemed_count != null ? Number(row.redeemed_count) : 0,
    created_at: row.created_at as string | undefined,
    created_by: row.created_by as string | undefined,
    updated_at: row.updated_at as string | undefined,
    updated_by: row.updated_by as string | undefined,
  };
}

export async function listCourseDiscounts(courseId: string): Promise<CourseDiscount[]> {
  const { data, error } = await supabase
    .from("course_discounts")
    .select("*")
    .eq("course_id", courseId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToDiscount(r as Record<string, unknown>));
}

export async function createCourseDiscount(
  courseId: string,
  data: CourseDiscountInsert,
  viewer?: User | null,
): Promise<CourseDiscount> {
  const user =
    viewer ??
    (
      await supabase.auth.getUser()
    ).data.user;
  if (!user) throw new Error("Chưa đăng nhập");

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const row = {
    id,
    course_id: courseId,
    code: normalizeDiscountCode(data.code),
    type: data.type,
    value: Number(data.value),
    active: data.active ?? true,
    starts_at: data.starts_at ?? null,
    ends_at: data.ends_at ?? null,
    max_redemptions: data.max_redemptions ?? null,
    redeemed_count: 0,
    created_at: now,
    created_by: user.id,
    updated_at: now,
    updated_by: user.id,
  };
  const { error } = await supabase.from("course_discounts").insert(row);
  if (error) throw new Error(error.message);
  return rowToDiscount(row as unknown as Record<string, unknown>);
}

export async function setCourseDiscountActive(
  courseId: string,
  discountId: string,
  active: boolean,
  viewer?: User | null,
) {
  const user =
    viewer ??
    (
      await supabase.auth.getUser()
    ).data.user;
  if (!user) throw new Error("Chưa đăng nhập");
  const { error } = await supabase
    .from("course_discounts")
    .update({
      active,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("course_id", courseId)
    .eq("id", discountId);
  if (error) throw new Error(error.message);
}

export async function deleteCourseDiscount(
  courseId: string,
  discountId: string,
  viewer?: User | null,
) {
  const user =
    viewer ??
    (
      await supabase.auth.getUser()
    ).data.user;
  if (!user) throw new Error("Chưa đăng nhập");
  const { error } = await supabase.from("course_discounts").delete().eq("course_id", courseId).eq("id", discountId);
  if (error) throw new Error(error.message);
}

export async function findCourseDiscountByCode(
  courseId: string,
  code: string,
): Promise<CourseDiscount | null> {
  const normalized = normalizeDiscountCode(code);
  const { data, error } = await supabase
    .from("course_discounts")
    .select("*")
    .eq("course_id", courseId)
    .eq("code", normalized)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return rowToDiscount(data as Record<string, unknown>);
}
