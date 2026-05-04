import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { COL } from "@/lib/collections";
import type {
  FinalAssignmentSubmission,
  FinalSubmissionStatus,
} from "@/types/courses";

/** Lấy bài nộp của học viên cho một khoá */
export async function getSubmission(
  userId: string,
  courseId: string
): Promise<FinalAssignmentSubmission | null> {
  const q = query(
    collection(db, COL.FINAL_ASSIGNMENT_SUBMISSIONS),
    where("user_id", "==", userId),
    where("course_id", "==", courseId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as FinalAssignmentSubmission;
}

/** Lấy tất cả bài nộp của một khoá (instructor) */
export async function getSubmissionsForCourse(
  courseId: string
): Promise<FinalAssignmentSubmission[]> {
  const q = query(
    collection(db, COL.FINAL_ASSIGNMENT_SUBMISSIONS),
    where("course_id", "==", courseId),
    orderBy("submitted_at", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinalAssignmentSubmission));
}

/** Học viên nộp bài tập cuối khoá */
export async function submitFinalAssignment(
  courseId: string,
  content: string,
  fileUrls?: string[]
): Promise<FinalAssignmentSubmission> {
  const user = auth.currentUser;
  if (!user) throw new Error("Chưa đăng nhập");

  const existing = await getSubmission(user.uid, courseId);
  if (existing && existing.status !== "rejected") {
    throw new Error("Bạn đã nộp bài rồi. Chỉ có thể nộp lại khi bài bị từ chối.");
  }

  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, COL.FINAL_ASSIGNMENT_SUBMISSIONS), {
    user_id: user.uid,
    course_id: courseId,
    content,
    file_urls: fileUrls ?? [],
    submitted_at: now,
    status: "pending",
  });
  return {
    id: ref.id,
    user_id: user.uid,
    course_id: courseId,
    content,
    file_urls: fileUrls,
    submitted_at: now,
    status: "pending",
  };
}

/** Instructor duyệt/từ chối bài nộp. Khi duyệt, tự động cấp chứng nhận nếu học viên đã hoàn thành 100% bài học. */
export async function updateSubmissionStatus(
  submissionId: string,
  status: FinalSubmissionStatus,
  reviewerComment?: string | null
): Promise<void> {
  const ref = doc(db, COL.FINAL_ASSIGNMENT_SUBMISSIONS, submissionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Không tìm thấy bài nộp");

  await updateDoc(ref, {
    status,
    reviewer_comment: reviewerComment ?? null,
    reviewed_at: new Date().toISOString(),
  });
}
