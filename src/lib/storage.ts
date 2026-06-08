import { supabase } from "@/lib/supabase";

// ─── Private `app` bucket (signed URLs — for non-credential assets) ───────────
const BUCKET = "app";
const SIGNED_URL_SEC = 60 * 60 * 24 * 365; // 1 year

// ─── Public `cdn` bucket (permanent public URLs — for credential images) ──────
// VITE_CDN_BASE_URL controls the domain:
//   Production:   https://cdn.corelia.academy          (Option B, Cloudflare proxy)
//              OR https://cdn.corelia.academy/storage/v1/object/public/cdn (Option A, Supabase custom domain)
//   Development:  unset → falls back to raw Supabase public URL
const CDN_BUCKET = "cdn";
const CDN_BASE_URL = (import.meta.env.VITE_CDN_BASE_URL as string | undefined)?.replace(/\/$/, "");

export function cdnPublicUrl(path: string): string {
  if (CDN_BASE_URL) {
    return `${CDN_BASE_URL}/${path}`;
  }
  // Dev fallback: raw Supabase public URL (permanent, no expiry, just less pretty)
  const { data } = supabase.storage.from(CDN_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function uploadToCdn(
  path: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  if (previousPath) {
    await deleteCdnObjectByPath(previousPath);
  }
  const { error } = await supabase.storage.from(CDN_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return { url: cdnPublicUrl(path), path };
}

export async function deleteCdnObjectByPath(path?: string | null): Promise<void> {
  const trimmed = String(path ?? "").trim();
  if (!trimmed) return;
  try {
    const { error } = await supabase.storage.from(CDN_BUCKET).remove([trimmed]);
    if (error) console.warn("[storage] cdn remove", trimmed, error.message);
  } catch {
    // ignore
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

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

/** Permanent CDN URL — hackathon credential badge for OC payload. */
export function uploadHackathonCredentialBadgeImage(
  hackathonId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  if (!hackathonId) throw new Error("Thiếu hackathonId");
  const ext = buildSafeExt(file.name, "png");
  return uploadToCdn(
    `credential-badges/hackathon/${hackathonId}/${Date.now()}.${ext}`,
    file,
    previousPath,
  );
}

/** Permanent CDN URL — activity milestone badge for OC payload. */
export function uploadActivityMilestoneBadgeImage(file: File): Promise<{ url: string; path: string }> {
  const ext = buildSafeExt(file.name, "png");
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  return uploadToCdn(`credential-badges/activity-milestone/${id}.${ext}`, file);
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

/** Permanent CDN URL — course certificate template image.
 *  Stored in the public `cdn` bucket so URLs never expire and canvas/fetch work without CORS issues. */
export function uploadCertificateTemplate(
  courseId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  if (!courseId) throw new Error("Thiếu courseId");
  const ext = buildSafeExt(file.name, "png");
  return uploadToCdn(`certificate-templates/${courseId}/${Date.now()}.${ext}`, file, previousPath);
}

/** Permanent CDN URL — rendered certificate PNG with learner name baked in.
 *  Path: certificates/{userId}/{courseId}.png
 *  Upserted on every render so the name is always current. */
export async function uploadRenderedCertificate(
  userId: string,
  courseId: string,
  blob: Blob,
): Promise<{ url: string; path: string }> {
  if (!userId) throw new Error("Thiếu userId");
  if (!courseId) throw new Error("Thiếu courseId");
  const path = `certificates/${userId}/${courseId}.png`;
  const { error } = await supabase.storage.from(CDN_BUCKET).upload(path, blob, {
    contentType: "image/png",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return { url: cdnPublicUrl(path), path };
}

/** Permanent CDN URL — course credential badge (OCB/OCA) for OC payload. */
export function uploadCourseCredentialBadgeImage(
  courseId: string,
  file: File,
  previousPath?: string | null,
): Promise<{ url: string; path: string }> {
  if (!courseId) throw new Error("Thiếu courseId");
  const ext = buildSafeExt(file.name, "png");
  return uploadToCdn(
    `credential-badges/course/${courseId}/${Date.now()}.${ext}`,
    file,
    previousPath,
  );
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
