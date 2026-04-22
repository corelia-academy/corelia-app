import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

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

export async function listCourseDiscounts(courseId: string): Promise<CourseDiscount[]> {
  const q = query(
    collection(db, "courses", courseId, "discounts"),
    orderBy("updated_at", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CourseDiscount));
}

export async function createCourseDiscount(
  courseId: string,
  data: CourseDiscountInsert,
): Promise<CourseDiscount> {
  const user = auth.currentUser;
  if (!user) throw new Error("Chưa đăng nhập");

  const now = new Date().toISOString();
  const payload = {
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
    created_by: user.uid,
    updated_at: now,
    updated_by: user.uid,
    // also store server timestamps for ordering if needed
    created_at_ts: serverTimestamp(),
    updated_at_ts: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "courses", courseId, "discounts"), payload);
  return { id: ref.id, ...(payload as unknown as Omit<CourseDiscount, "id">) };
}

export async function setCourseDiscountActive(
  courseId: string,
  discountId: string,
  active: boolean,
) {
  const user = auth.currentUser;
  if (!user) throw new Error("Chưa đăng nhập");
  await updateDoc(doc(db, "courses", courseId, "discounts", discountId), {
    active,
    updated_at: new Date().toISOString(),
    updated_by: user.uid,
    updated_at_ts: serverTimestamp(),
  });
}

export async function deleteCourseDiscount(courseId: string, discountId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Chưa đăng nhập");
  await deleteDoc(doc(db, "courses", courseId, "discounts", discountId));
}

export async function findCourseDiscountByCode(
  courseId: string,
  code: string,
): Promise<CourseDiscount | null> {
  const normalized = normalizeDiscountCode(code);
  const q = query(
    collection(db, "courses", courseId, "discounts"),
    where("code", "==", normalized),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return { id: d.id, ...d.data() } as CourseDiscount;
}

