import { describe, expect, it } from "vitest";
import { sanitizeInternalRedirect } from "./utils/redirect";

describe("sanitizeInternalRedirect", () => {
  it("allows safe relative paths", () => {
    expect(sanitizeInternalRedirect("/hackathons/corelia-web3-ai-2026")).toBe(
      "/hackathons/corelia-web3-ai-2026",
    );
    expect(
      sanitizeInternalRedirect("/hackathons/demo#participant-workspace"),
    ).toBe("/hackathons/demo#participant-workspace");
    expect(sanitizeInternalRedirect("/projects/123?tab=overview")).toBe(
      "/projects/123?tab=overview",
    );
  });

  it("falls back to root on empty or nullish values", () => {
    expect(sanitizeInternalRedirect(null)).toBe("/");
    expect(sanitizeInternalRedirect(undefined)).toBe("/");
    expect(sanitizeInternalRedirect("")).toBe("/");
    expect(sanitizeInternalRedirect("   ")).toBe("/");
  });

  it("blocks protocol-relative URLs (open redirect)", () => {
    expect(sanitizeInternalRedirect("//evil.com")).toBe("/");
    expect(sanitizeInternalRedirect("//evil.com/path")).toBe("/");
  });

  it("blocks absolute URLs with external protocols", () => {
    expect(sanitizeInternalRedirect("https://evil.com")).toBe("/");
    expect(sanitizeInternalRedirect("http://evil.com")).toBe("/");
    expect(sanitizeInternalRedirect("javascript:alert(1)")).toBe("/");
    expect(sanitizeInternalRedirect("data:text/html,evil")).toBe("/");
  });

  it("blocks backslash bypasses", () => {
    expect(sanitizeInternalRedirect("/\\evil.com")).toBe("/");
    expect(sanitizeInternalRedirect("\\evil.com")).toBe("/");
  });

  it("blocks relative paths not starting with slash", () => {
    expect(sanitizeInternalRedirect("hackathons/demo")).toBe("/");
    expect(sanitizeInternalRedirect("../admin")).toBe("/");
  });
});
