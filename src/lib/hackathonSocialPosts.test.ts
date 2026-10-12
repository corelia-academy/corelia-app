import { describe, expect, it } from "vitest";
import { getHackathonSocialPostEmbed } from "./hackathonSocialPosts";

describe("hackathon social post embeds", () => {
  it("accepts post URLs from supported platforms", () => {
    expect(getHackathonSocialPostEmbed("https://x.com/corelia/status/123")?.url).toContain("id=123");
    expect(getHackathonSocialPostEmbed("https://www.instagram.com/reel/Ab_12-/")?.url).toBe("https://www.instagram.com/reel/Ab_12-/embed/");
    expect(getHackathonSocialPostEmbed("https://www.facebook.com/corelia/posts/123")?.url).toContain("plugins/post.php");
  });

  it("rejects unsafe and non-post URLs", () => {
    for (const url of ["javascript:alert(1)", "http://x.com/a/status/123", "https://x.com.evil.test/a/status/123", "https://x.com/corelia", "https://www.instagram.com/corelia/", "https://facebook.com.evil.test/x/posts/1"]) {
      expect(getHackathonSocialPostEmbed(url)).toBeNull();
    }
  });
});
