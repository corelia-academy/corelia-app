import { afterEach, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ upload: vi.fn(), createSignedUrl: vi.fn(), remove: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: { storage: { from: () => storage } } }));
import { uploadFinalAssignmentFile, uploadCourseThumbnail, uploadCertificateTemplate, uploadOnchainCertificateTemplate, uploadCourseCredentialBadgeImage, uploadCourseSponsorLogo, uploadCoursePartnerLogo, uploadCoursePartnerBrandLogo } from "./storage";
afterEach(() => vi.clearAllMocks());
it("uses independent immutable file paths even when uploaded in the same millisecond", async () => {
  storage.upload.mockResolvedValue({ error: null });
  storage.createSignedUrl.mockResolvedValue({ data: { signedUrl: "http://localhost/file" }, error: null });
  const file = { name: "project.zip", type: "application/zip" } as File;
  const a = await uploadFinalAssignmentFile("course", "learner", file);
  const b = await uploadFinalAssignmentFile("course", "learner", file);
  expect(a.path).not.toBe(b.path);
  expect(storage.upload).toHaveBeenCalledWith(a.path, file, { contentType: "application/zip", upsert: false });
});
it("rejects storage failures and does not fabricate a download URL", async () => {
  storage.upload.mockResolvedValue({ error: { message: "Upload denied" } });
  await expect(uploadFinalAssignmentFile("course", "learner", { name: "a.zip" } as File)).rejects.toThrow("Upload denied");
  expect(storage.createSignedUrl).not.toHaveBeenCalled();
});


it("never deletes referenced Learning assets when a replacement upload fails", async () => {
  storage.upload.mockResolvedValue({ error: { message: "Network failure" } });
  const file = { name: "image.png", type: "image/png" } as File;
  const uploads = [
    () => uploadCourseThumbnail("course", file, "old.png"),
    () => uploadCertificateTemplate("course", file, "old.png"),
    () => uploadOnchainCertificateTemplate("course", file, "old.png"),
    () => uploadCourseCredentialBadgeImage("course", file, "old.png"),
    () => uploadCourseSponsorLogo("course", "sponsor", file, "old.png"),
    () => uploadCoursePartnerLogo("course", "partner", file, "old.png"),
    () => uploadCoursePartnerBrandLogo("course", file, "old.png"),
  ];
  for (const upload of uploads) await expect(upload()).rejects.toThrow("Network failure");
  expect(storage.remove).not.toHaveBeenCalled();
});
