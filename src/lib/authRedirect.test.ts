import { describe, expect, it } from "vitest";
import {
  formatLocationTarget,
  resolveAuthRedirect,
  sanitizeRedirectUrl,
} from "./authRedirect";

describe("authRedirect helper", () => {
  describe("sanitizeRedirectUrl", () => {
    it("preserves valid internal paths with query and hash", () => {
      expect(sanitizeRedirectUrl("/hackathons/core-hack/overview?tab=prizes#faq")).toBe(
        "/hackathons/core-hack/overview?tab=prizes#faq",
      );
      expect(sanitizeRedirectUrl("/jobs?salary=1000&currency=USD")).toBe(
        "/jobs?salary=1000&currency=USD",
      );
    });

    it("rejects external URLs and protocol-relative URLs", () => {
      expect(sanitizeRedirectUrl("https://evil.com")).toBe("/");
      expect(sanitizeRedirectUrl("http://evil.com")).toBe("/");
      expect(sanitizeRedirectUrl("//evil.com")).toBe("/");
      expect(sanitizeRedirectUrl("/\\evil.com")).toBe("/");
      expect(sanitizeRedirectUrl("\\evil.com")).toBe("/");
      expect(sanitizeRedirectUrl("javascript:alert(1)")).toBe("/");
    });

    it("rejects loops back to /login or /auth", () => {
      expect(sanitizeRedirectUrl("/login")).toBe("/");
      expect(sanitizeRedirectUrl("/login?next=/dashboard")).toBe("/");
      expect(sanitizeRedirectUrl("/login/reset")).toBe("/");
      expect(sanitizeRedirectUrl("/auth")).toBe("/");
      expect(sanitizeRedirectUrl("/auth/callback?code=123")).toBe("/");
      expect(sanitizeRedirectUrl("/auth/v1/verify")).toBe("/");
    });

    it("fallbacks to / on empty or non-string", () => {
      expect(sanitizeRedirectUrl("")).toBe("/");
      expect(sanitizeRedirectUrl("   ")).toBe("/");
      expect(sanitizeRedirectUrl(null)).toBe("/");
      expect(sanitizeRedirectUrl(undefined)).toBe("/");
    });
  });

  describe("formatLocationTarget", () => {
    it("formats pathname, search, and hash", () => {
      expect(
        formatLocationTarget({
          pathname: "/courses/123",
          search: "?mode=review",
          hash: "#chapter-2",
        }),
      ).toBe("/courses/123?mode=review#chapter-2");
    });

    it("handles missing search or hash", () => {
      expect(formatLocationTarget({ pathname: "/feed" })).toBe("/feed");
      expect(formatLocationTarget(null)).toBeNull();
    });
  });

  describe("resolveAuthRedirect", () => {
    it("prefers redirect param over next param according to contract", () => {
      const search = new URLSearchParams("next=/a&redirect=/b");
      const state = { from: { pathname: "/state-page" } };
      expect(resolveAuthRedirect(state, search)).toBe("/b");
    });

    it("respects precedence order: redirect > redirect_to > return_to > next", () => {
      const search1 = new URLSearchParams("next=/next&return_to=/return");
      expect(resolveAuthRedirect(null, search1)).toBe("/return");

      const search2 = new URLSearchParams("return_to=/return&redirect_to=/redirect-to");
      expect(resolveAuthRedirect(null, search2)).toBe("/redirect-to");

      const search3 = new URLSearchParams("redirect_to=/redirect-to&redirect=/redirect-main");
      expect(resolveAuthRedirect(null, search3)).toBe("/redirect-main");
    });

    it("falls back to next param if earlier redirect params are absent", () => {
      const search = new URLSearchParams("next=/next-page");
      const state = { from: { pathname: "/state-page" } };
      expect(resolveAuthRedirect(state, search)).toBe("/next-page");
    });

    it("falls back to location.state.from with full query/hash", () => {
      const search = new URLSearchParams();
      const state = {
        from: {
          pathname: "/hackathons/demo",
          search: "?tab=timeline",
          hash: "#milestones",
        },
      };
      expect(resolveAuthRedirect(state, search)).toBe(
        "/hackathons/demo?tab=timeline#milestones",
      );
    });

    it("handles state.from as string", () => {
      const state = { from: "/feed?sort=popular" };
      expect(resolveAuthRedirect(state, null)).toBe("/feed?sort=popular");
    });

    it("rejects /auth and /login targets from query or state and falls back", () => {
      const searchLogin = new URLSearchParams("redirect=/login");
      expect(resolveAuthRedirect(null, searchLogin)).toBe("/");

      const searchAuth = new URLSearchParams("redirect=/auth/callback");
      expect(resolveAuthRedirect(null, searchAuth)).toBe("/");

      const stateAuth = { from: "/auth/v1/verify" };
      expect(resolveAuthRedirect(stateAuth, null)).toBe("/");
    });

    it("returns / when no redirect target provided or invalid", () => {
      expect(resolveAuthRedirect(null, null)).toBe("/");
      const search = new URLSearchParams("next=https://malicious.example");
      expect(resolveAuthRedirect(null, search)).toBe("/");
    });
  });
});
