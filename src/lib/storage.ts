import { supabase } from "@/lib/supabase";

const BUCKET = "app";
const SIGNED_URL_SEC = 60 * 60 * 24 * 365; // 1 year — private bucket; refresh via re-upload if needed

function buildSafeExt(filename: string, fallback = "jpg"): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return /^[a-z0-9]+$/.test(ext) ? ext : fallback;
}

async function signedUrlForPath(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_SEC);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Không tạo được URL tải file.");
  return data.signedUrl;
}

async function uploadToPath(
  path: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  await deleteStorageObjectByPath(previousPath);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const url = await signedUrlForPath(path);
  return { url, path };
}

export async function deleteStorageObjectByPath(path?: string | null): Promise<void> {
  const trimmed = String(path ?? "").trim();
  if (!trimmed) return;
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([trimmed]);
    if (error) console.warn("[storage] remove", trimmed, error.message);
  } catch {
    // ignore
  }
}

export function uploadCourseThumbnail(
  courseId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  if (!courseId) throw new Error("Thiếu courseId khi upload ảnh bìa");
  const ext = buildSafeExt(file.name);
  return uploadToPath(`course-thumbnails/${courseId}/${Date.now()}.${ext}`, file, previousPath);
}

export function uploadCareerTrackThumbnail(
  trackId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  if (!trackId) throw new Error("Thiếu trackId khi upload ảnh bìa");
  const ext = buildSafeExt(file.name);
  return uploadToPath(
    `career-track-thumbnails/${trackId}/${Date.now()}.${ext}`,
    file,
    previousPath,
  );
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

export function uploadHackathonCredentialBadgeImage(
  hackathonId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  if (!hackathonId) throw new Error("Thiếu hackathonId");
  const ext = buildSafeExt(file.name, "png");
  return uploadToPath(
    `hackathon-credential-badges/${hackathonId}/${Date.now()}.${ext}`,
    file,
    previousPath,
  );
}

export function uploadActivityMilestoneBadgeImage(file: File): Promise<{ url: string; path: string }> {
  const ext = buildSafeExt(file.name, "png");
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  return uploadToPath(`activity-milestone-badges/${id}.${ext}`, file);
}

export function uploadContestOrganizationalPartnerLogo(
  contestId: string,
  partnerId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  const cid = String(contestId ?? "").trim();
  const pid = String(partnerId ?? "").trim();
  if (!cid) throw new Error("Thiếu contestId");
  if (!pid) throw new Error("Thiếu partnerId");
  const ext = buildSafeExt(file.name, "png");
  return uploadToPath(
    `contest-org-partner-logos/${cid}/${pid}/${Date.now()}.${ext}`,
    file,
    previousPath,
  );
}

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

export function uploadCertificateTemplate(
  courseId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  if (!courseId) throw new Error("Thiếu courseId");
  const ext = buildSafeExt(file.name, "png");
  return uploadToPath(`certificate-templates/${courseId}/${Date.now()}.${ext}`, file, previousPath);
}

/** Image for Open Campus badge (OCB) tied to a course template. */
export function uploadCourseCredentialBadgeImage(
  courseId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  if (!courseId) throw new Error("Thiếu courseId");
  const ext = buildSafeExt(file.name, "png");
  return uploadToPath(`course-credential-badges/${courseId}/${Date.now()}.${ext}`, file, previousPath);
}

export function uploadCoursePartnerDocument(
  courseId: string,
  kind: "contract" | "invoice",
  file: File,
): Promise<{ url: string; path: string }> {
  if (!courseId) throw new Error("Thiếu courseId");
  const safeName = (file.name || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
  return uploadToPath(`course-partner-docs/${courseId}/${kind}/${Date.now()}-${safeName}`, file);
}

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

/** ảnh đại diện: avatars/{userId}/{timestamp}.{ext} */
export function uploadUserAvatar(userId: string, file: File): Promise<{ url: string; path: string }> {
  if (!userId) throw new Error("Thiếu userId");
  const ext = buildSafeExt(file.name, "jpg");
  return uploadToPath(`avatars/${userId}/${Date.now()}.${ext}`, file);
}

/** Image attachment for a Cora chat message: cora-attachments/{userId}/{timestamp}-{uuid}.{ext} */
export function uploadCoraImageAttachment(
  userId: string,
  file: File,
): Promise<{ url: string; path: string }> {
  if (!userId) throw new Error("Thiếu userId");
  const ext = buildSafeExt(file.name, "jpg");
  const uniq =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now());
  return uploadToPath(`cora-attachments/${userId}/${Date.now()}-${uniq}.${ext}`, file);
}
