import { describe, expect, it } from "vitest";

import {
  blogPostFormFromRecord,
  blogPublicPath,
  blogTranslationFormFromRecord,
  buildBlogPostInput,
  emptyBlogPostForm,
  slugifyBlogTitle,
  type BlogPostForm,
} from "@/features/blog/blogPost";
import type { BlogPostRecord } from "@/types/blog";

const form = (patch: Partial<BlogPostForm> = {}): BlogPostForm => ({
  ...emptyBlogPostForm("vi"),
  title: "  Khởi động UniHackFest  ",
  slug: "khoi-dong-unihackfest",
  publishedOn: "2026-11-14",
  tags: ["web3", "hackathon", "ecosystem"],
  body: "Nội dung\r\nbài viết",
  ...patch,
});

const record: BlogPostRecord = {
  id: "1",
  locale: "en",
  slug: "kickoff",
  translation_key: "unihackfest-kickoff",
  content_type: "case-study",
  status: "published",
  title: "Kickoff",
  category: "announcements-events",
  author: "terran",
  published_on: "2026-03-05",
  updated_at: "2026-03-06T00:00:00Z",
  description: "Summary",
  tags: ["web3", "hackathon", "ecosystem", "retired-tag"],
  media: { type: "image", src: "/blog/cover.jpg", alt: "Cover", ogSrc: "/blog/og/cover.jpg" },
  body: "Body",
};

describe("slugifyBlogTitle", () => {
  it("removes Vietnamese accents and punctuation", () => {
    expect(slugifyBlogTitle("Đại học Hùng Vương: UniTour #2 – 2026!")).toBe("dai-hoc-hung-vuong-unitour-2-2026");
  });

  it("returns an empty slug for a title without letters or digits", () => {
    expect(slugifyBlogTitle(" — ")).toBe("");
  });
});

describe("blogPublicPath", () => {
  it("maps language and content type to the landing URL", () => {
    expect(blogPublicPath({ locale: "en", slug: "a", content_type: "blog" })).toBe("/blog/a");
    expect(blogPublicPath({ locale: "vi", slug: "a", content_type: "blog" })).toBe("/vi/blog/a");
    expect(blogPublicPath({ locale: "vi", slug: "a", content_type: "case-study" })).toBe("/vi/case-studies/a");
  });
});

describe("buildBlogPostInput", () => {
  it("builds a published row and defaults the translation key to the slug", () => {
    const result = buildBlogPostInput(form(), "published");
    expect(result).toEqual({
      input: expect.objectContaining({
        title: "Khởi động UniHackFest",
        slug: "khoi-dong-unihackfest",
        translation_key: "khoi-dong-unihackfest",
        status: "published",
        body: "Nội dung\nbài viết",
        media: null,
        description: null,
      }),
    });
  });

  it("lets a draft be saved without tags or body", () => {
    expect(buildBlogPostInput(form({ tags: [], body: "" }), "draft")).toHaveProperty("input");
  });

  it("requires 3–6 tags and a body to publish", () => {
    expect(buildBlogPostInput(form({ tags: ["web3"] }), "published")).toEqual({ error: "tagsCount" });
    expect(buildBlogPostInput(form({ body: "  " }), "published")).toEqual({ error: "bodyRequired" });
  });

  it("rejects an invalid slug, date and cover", () => {
    expect(buildBlogPostInput(form({ slug: "Not A Slug" }), "draft")).toEqual({ error: "slugInvalid" });
    expect(buildBlogPostInput(form({ publishedOn: "14/11/2026" }), "draft")).toEqual({ error: "dateInvalid" });
    expect(buildBlogPostInput(form({ mediaKind: "image", imageSrc: "javascript:alert(1)" }), "draft")).toEqual({ error: "imageUrlInvalid" });
    expect(buildBlogPostInput(form({ mediaKind: "image" }), "published")).toEqual({ error: "imageRequired" });
    expect(buildBlogPostInput(form({ mediaKind: "youtube", youtubeUrl: "https://example.com/v" }), "draft")).toEqual({ error: "youtubeInvalid" });
  });

  it("keeps the cover image fields", () => {
    const result = buildBlogPostInput(
      form({ mediaKind: "image", imageSrc: "https://cdn.corelia.academy/blog/a.jpg", imageAlt: "Alt", imageFit: "contain" }),
      "draft",
    );
    expect(result).toEqual({
      input: expect.objectContaining({
        media: { type: "image", src: "https://cdn.corelia.academy/blog/a.jpg", alt: "Alt", fit: "contain" },
      }),
    });
  });
});

describe("forms from a saved article", () => {
  it("round-trips a record and drops tags that no longer exist", () => {
    const loaded = blogPostFormFromRecord(record);
    expect(loaded.tags).toEqual(["web3", "hackathon", "ecosystem"]);
    expect(buildBlogPostInput(loaded, "published")).toEqual({
      input: expect.objectContaining({ translation_key: "unihackfest-kickoff", content_type: "case-study", media: record.media }),
    });
  });

  it("starts a translation in the other language with the shared fields", () => {
    const translation = blogTranslationFormFromRecord(record);
    expect(translation).toMatchObject({
      locale: "vi",
      translationKey: "unihackfest-kickoff",
      contentType: "case-study",
      publishedOn: "2026-03-05",
      imageSrc: "/blog/cover.jpg",
      title: "",
      slug: "",
      body: "",
    });
  });
});
