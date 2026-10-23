import { afterEach, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({
  from: vi.fn(),
  upload: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
  getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/cdn/${path}` } })),
}));
vi.mock("./supabase", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => {
        storage.from(bucket);
        return {
          upload: (...args: unknown[]) => storage.upload(bucket, ...args),
          update: (...args: unknown[]) => storage.update(bucket, ...args),
          remove: (...args: unknown[]) => storage.remove(bucket, ...args),
          createSignedUrl: storage.createSignedUrl,
          getPublicUrl: storage.getPublicUrl,
        };
      },
    },
  },
}));
import { deleteContestMediaByPath, uploadContestBanner, uploadContestThumbnail, uploadCourseThumbnail } from "./storage";
afterEach(() => vi.clearAllMocks());
const file = { name: "cover.png", type: "image/png" } as File;

it("stores course thumbnails in the public cdn bucket with a non-expiring URL", async () => {
  storage.upload.mockResolvedValue({ error: null });
  const result = await uploadCourseThumbnail("course-1", file, "course-thumbnails/course-1/old.png");
  expect(result.path).toMatch(/^course-thumbnails\/course-1\/[\w-]+\.png$/);
  expect(storage.upload).toHaveBeenCalledWith("cdn", result.path, file, { contentType: "image/png" });
  expect(result.url).toBe(`https://project.supabase.co/storage/v1/object/public/cdn/${result.path}`);
  expect(storage.createSignedUrl).not.toHaveBeenCalled();
  // The previous cover can still be referenced until the course Save succeeds.
  expect(storage.remove).not.toHaveBeenCalled();
});

it.each([
  ["banner", uploadContestBanner, "contest-banners"],
  ["thumbnail", uploadContestThumbnail, "contest-thumbnails"],
] as const)("stores hackathon %s artwork in cdn and clears the previous object from both buckets", async (_, upload, folder) => {
  storage.upload.mockResolvedValue({ error: null });
  storage.remove.mockResolvedValue({ error: null });
  const result = await upload("hackathon-1", file, `${folder}/hackathon-1/old.png`);
  expect(result.path).toMatch(new RegExp(`^${folder}/hackathon-1/\\d+\\.png$`));
  expect(storage.upload).toHaveBeenCalledWith("cdn", result.path, file, { contentType: "image/png" });
  expect(result.url).toContain("/object/public/cdn/");
  expect(storage.createSignedUrl).not.toHaveBeenCalled();
  expect(storage.remove).toHaveBeenCalledWith("cdn", [`${folder}/hackathon-1/old.png`]);
  expect(storage.remove).toHaveBeenCalledWith("app", [`${folder}/hackathon-1/old.png`]);
});

it("ignores an empty hackathon media path", async () => {
  await deleteContestMediaByPath("  ");
  expect(storage.remove).not.toHaveBeenCalled();
});
