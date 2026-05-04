import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase";

// ─── Helpers dùng nội bộ ──────────────────────────────────────────────────────

/** Lấy extension an toàn từ tên file (chỉ gồm a-z0-9). */
function buildSafeExt(filename: string, fallback = "jpg"): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return /^[a-z0-9]+$/.test(ext) ? ext : fallback;
}

/**
 * Helper dùng chung: xoá file cũ (nếu có) rồi upload file mới.
 * Trả về { url, path } để lưu vào Firestore.
 */
async function uploadToPath(
  path: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  await deleteStorageObjectByPath(previousPath);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream",
  });
  return { url: await getDownloadURL(storageRef), path };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function deleteStorageObjectByPath(path?: string | null): Promise<void> {
  const trimmed = String(path ?? "").trim();
  if (!trimmed) return;
  try {
    await deleteObject(ref(storage, trimmed));
  } catch {
    // ignore missing / permission / transient errors
  }
}

/**
 * Upload ảnh bìa khoá học lên Firebase Storage.
 * - Nếu có previousPath thì xoá ảnh cũ trước.
 * - Trả về { url, path } để lưu vào Firestore (thumbnail_url, thumbnail_path).
 */
export function uploadCourseThumbnail(
  courseId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  if (!courseId) throw new Error("Thiếu courseId khi upload ảnh bìa");
  const ext = buildSafeExt(file.name);
  return uploadToPath(`course-thumbnails/${courseId}/${Date.now()}.${ext}`, file, previousPath);
}

export function uploadContestBanner(
  contestId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  if (!contestId) throw new Error("Thiếu contestId khi upload banner");
  const ext = buildSafeExt(file.name);
  return uploadToPath(`contest-banners/${contestId}/${Date.now()}.${ext}`, file, previousPath);
}

export function uploadContestThumbnail(
  contestId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  if (!contestId) throw new Error("Thiếu contestId khi upload thumbnail");
  const ext = buildSafeExt(file.name);
  return uploadToPath(`contest-thumbnails/${contestId}/${Date.now()}.${ext}`, file, previousPath);
}

/**
 * Upload file bài tập cuối khoá (học viên nộp).
 * Đường dẫn: final-assignment-submissions/{courseId}/{userId}/{timestamp}.{ext}
 */
export function uploadFinalAssignmentFile(
  courseId: string,
  userId: string,
  file: File,
): Promise<{ url: string; path: string }> {
  const ext = buildSafeExt(file.name, "pdf");
  return uploadToPath(
    `final-assignment-submissions/${courseId}/${userId}/${Date.now()}.${ext}`,
    file,
  );
}

/**
 * Upload template chứng nhận khoá học (instructor).
 * Đường dẫn: certificate-templates/{courseId}/{timestamp}.{ext}
 */
export function uploadCertificateTemplate(
  courseId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  if (!courseId) throw new Error("Thiếu courseId");
  const ext = buildSafeExt(file.name, "png");
  return uploadToPath(`certificate-templates/${courseId}/${Date.now()}.${ext}`, file, previousPath);
}

/**
 * Upload tài liệu đối tác cho khoá học (hợp đồng / hoá đơn).
 * Đường dẫn: course-partner-docs/{courseId}/{kind}/{timestamp}-{filename}
 */
export function uploadCoursePartnerDocument(
  courseId: string,
  kind: "contract" | "invoice",
  file: File,
): Promise<{ url: string; path: string }> {
  if (!courseId) throw new Error("Thiếu courseId");
  const safeName = (file.name || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
  return uploadToPath(`course-partner-docs/${courseId}/${kind}/${Date.now()}-${safeName}`, file);
}

/**
 * Upload logo sponsor cho khoá học (instructor/admin).
 * Đường dẫn: course-sponsor-logos/{courseId}/{sponsorId}/{timestamp}.{ext}
 */
export function uploadCourseSponsorLogo(
  courseId: string,
  sponsorId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  const cid = String(courseId ?? "").trim();
  const sid = String(sponsorId ?? "").trim();
  if (!cid) throw new Error("Thiếu courseId");
  if (!sid) throw new Error("Thiếu sponsorId");
  const ext = buildSafeExt(file.name, "png");
  return uploadToPath(`course-sponsor-logos/${cid}/${sid}/${Date.now()}.${ext}`, file, previousPath);
}

/**
 * Upload logo partner cho khoá học (instructor/admin).
 * Đường dẫn: course-partners/{courseId}/{partnerId}/{timestamp}.{ext}
 */
export function uploadCoursePartnerLogo(
  courseId: string,
  partnerId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  const cid = String(courseId ?? "").trim();
  const pid = String(partnerId ?? "").trim();
  if (!cid) throw new Error("Thiếu courseId");
  if (!pid) throw new Error("Thiếu partnerId");
  const ext = buildSafeExt(file.name, "png");
  return uploadToPath(`course-partners/${cid}/${pid}/${Date.now()}.${ext}`, file, previousPath);
}

/**
 * Upload logo brand cho khoá học đối tác (instructor/admin).
 * Đường dẫn: course-partner-brand/{courseId}/{timestamp}.{ext}
 */
export function uploadCoursePartnerBrandLogo(
  courseId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  const cid = String(courseId ?? "").trim();
  if (!cid) throw new Error("Thiếu courseId");
  const ext = buildSafeExt(file.name, "png");
  return uploadToPath(`course-partner-brand/${cid}/${Date.now()}.${ext}`, file, previousPath);
}

/**
 * Upload tài liệu đối tác ở cấp giảng viên (hợp đồng / hoá đơn).
 * Đường dẫn: instructor-partner-docs/{instructorId}/{kind}/{timestamp}-{filename}
 */
export function uploadInstructorPartnerDocument(
  instructorId: string,
  kind: "contract" | "invoice",
  file: File,
): Promise<{ url: string; path: string }> {
  if (!instructorId) throw new Error("Thiếu instructorId");
  const safeName = (file.name || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
  return uploadToPath(
    `instructor-partner-docs/${instructorId}/${kind}/${Date.now()}-${safeName}`,
    file,
  );
}

