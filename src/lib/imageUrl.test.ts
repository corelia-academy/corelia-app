import { afterEach, describe, expect, it, vi } from "vitest";
import { optimizedImageSrcSet, optimizedImageUrl } from "./imageUrl";

const PUBLIC = "https://cdn.corelia.academy/storage/v1/object/public/cdn/a/b.png";
const SIGNED = "https://x.supabase.co/storage/v1/object/sign/app/a.jpg?token=t";

afterEach(() => vi.unstubAllEnvs());

describe("optimizedImageUrl", () => {
  it("returns the url unchanged when transformation is off", () => {
    expect(optimizedImageUrl(PUBLIC, { width: 320 })).toBe(PUBLIC);
    expect(optimizedImageSrcSet(PUBLIC, 320)).toBeUndefined();
    expect(optimizedImageUrl(null, { width: 320 })).toBe("");
  });

  it("uses Supabase render endpoint and keeps the signed token", () => {
    vi.stubEnv("VITE_IMAGE_TRANSFORM", "supabase");
    expect(optimizedImageUrl(SIGNED, { width: 320 })).toBe(
      "https://x.supabase.co/storage/v1/render/image/sign/app/a.jpg?token=t&width=320&quality=75&resize=cover",
    );
    expect(optimizedImageUrl("https://example.com/a.png", { width: 320 })).toBe("https://example.com/a.png");
    expect(optimizedImageSrcSet(PUBLIC, 100)).toContain("width=200");
  });

  it("uses cdn-cgi only on a proxied hostname", () => {
    vi.stubEnv("VITE_IMAGE_TRANSFORM", "cloudflare");
    expect(optimizedImageUrl(PUBLIC, { width: 320 })).toBe(
      "https://cdn.corelia.academy/cdn-cgi/image/width=320,quality=75,format=auto/storage/v1/object/public/cdn/a/b.png",
    );
    expect(optimizedImageUrl(SIGNED, { width: 320 })).toBe(SIGNED);
  });
});
