import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase";

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
 * - Nếu có previousPath thì cố gắng xoá ảnh cũ trước.
 * - Trả về { url, path } để lưu vào Firestore (thumbnail_url, thumbnail_path).
 */
export async function uploadCourseThumbnail(
  courseId: string,
  file: File,
  previousPath?: string,
): Promise<{ url: string; path: string }> {
  if (!courseId) {
    throw new Error("Thiếu courseId khi upload ảnh bìa");
  }

  // Xoá ảnh cũ nếu có
  await deleteStorageObjectByPath(previousPath);

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
  const path = `course-thumbnails/${courseId}/${Date.now()}.${safeExt}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type || `image/${safeExt}`,
  });

  const url = await getDownloadURL(storageRef);
  return { url, path };
}

/**
 * Upload file bài tập cuối khoá (học viên nộp).
 * Đường dẫn: final-assignment-submissions/{courseId}/{userId}/{timestamp}.{ext}
 */
export async function uploadFinalAssignmentFile(
  courseId: string,
  userId: string,
  file: File
): Promise<{ url: string; path: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "pdf";
  const path = `final-assignment-submissions/${courseId}/${userId}/${Date.now()}.${safeExt}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type || `application/${safeExt}`,
  });

  const url = await getDownloadURL(storageRef);
  return { url, path };
}

/**
 * Upload template chứng nhận khoá học (instructor).
 * Đường dẫn: certificate-templates/{courseId}/{timestamp}.{ext}
 */
export async function uploadCertificateTemplate(
  courseId: string,
  file: File,
  previousPath?: string
): Promise<{ url: string; path: string }> {
  if (!courseId) throw new Error("Thiếu courseId");

  await deleteStorageObjectByPath(previousPath);

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "png";
  const path = `certificate-templates/${courseId}/${Date.now()}.${safeExt}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type || `image/${safeExt}`,
  });

  const url = await getDownloadURL(storageRef);
  return { url, path };
}

/**
 * Upload tài liệu đối tác cho khoá học (hợp đồng / hoá đơn).
 * Đường dẫn: course-partner-docs/{courseId}/{kind}/{timestamp}-{filename}
 */
export async function uploadCoursePartnerDocument(
  courseId: string,
  kind: "contract" | "invoice",
  file: File,
): Promise<{ url: string; path: string }> {
  if (!courseId) throw new Error("Thiếu courseId");
  const rawName = file.name || "document";
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `course-partner-docs/${courseId}/${kind}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream",
  });

  const url = await getDownloadURL(storageRef);
  return { url, path };
}

/**
 * Upload logo sponsor cho khoá học (instructor/admin).
 * Đường dẫn: course-sponsor-logos/{courseId}/{sponsorId}/{timestamp}.{ext}
 */
export async function uploadCourseSponsorLogo(
  courseId: string,
  sponsorId: string,
  file: File,
  previousPath?: string,
): Promise<{ url: string; path: string }> {
  const cid = String(courseId ?? "").trim();
  const sid = String(sponsorId ?? "").trim();
  if (!cid) throw new Error("Thiếu courseId");
  if (!sid) throw new Error("Thiếu sponsorId");

  await deleteStorageObjectByPath(previousPath);

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "png";
  const path = `course-sponsor-logos/${cid}/${sid}/${Date.now()}.${safeExt}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type || `image/${safeExt}`,
  });

  const url = await getDownloadURL(storageRef);
  return { url, path };
}

/**
 * Upload logo partner cho khoá học (instructor/admin).
 * Đường dẫn: course-partners/{courseId}/{partnerId}/{timestamp}.{ext}
 */
export async function uploadCoursePartnerLogo(
  courseId: string,
  partnerId: string,
  file: File,
  previousPath?: string,
): Promise<{ url: string; path: string }> {
  const cid = String(courseId ?? "").trim();
  const pid = String(partnerId ?? "").trim();
  if (!cid) throw new Error("Thiếu courseId");
  if (!pid) throw new Error("Thiếu partnerId");

  await deleteStorageObjectByPath(previousPath);

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "png";
  const path = `course-partners/${cid}/${pid}/${Date.now()}.${safeExt}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type || `image/${safeExt}`,
  });

  const url = await getDownloadURL(storageRef);
  return { url, path };
}

/**
 * Upload logo brand cho khoá học đối tác (instructor/admin).
 * Đường dẫn: course-partner-brand/{courseId}/{timestamp}.{ext}
 */
export async function uploadCoursePartnerBrandLogo(
  courseId: string,
  file: File,
  previousPath?: string,
): Promise<{ url: string; path: string }> {
  const cid = String(courseId ?? "").trim();
  if (!cid) throw new Error("Thiếu courseId");

  await deleteStorageObjectByPath(previousPath);

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "png";
  const path = `course-partner-brand/${cid}/${Date.now()}.${safeExt}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type || `image/${safeExt}`,
  });

  const url = await getDownloadURL(storageRef);
  return { url, path };
}

/**
 * Upload tài liệu đối tác ở cấp giảng viên (hợp đồng / hoá đơn).
 * Đường dẫn: instructor-partner-docs/{instructorId}/{kind}/{timestamp}-{filename}
 */
export async function uploadInstructorPartnerDocument(
  instructorId: string,
  kind: "contract" | "invoice",
  file: File,
): Promise<{ url: string; path: string }> {
  if (!instructorId) throw new Error("Thiếu instructorId");
  const rawName = file.name || "document";
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `instructor-partner-docs/${instructorId}/${kind}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream",
  });

  const url = await getDownloadURL(storageRef);
  return { url, path };
}
