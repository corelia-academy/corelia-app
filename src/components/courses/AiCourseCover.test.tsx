// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { AiCourseCover } from "./AiCourseCover";

const markup = (seed: string) => renderToStaticMarkup(<AiCourseCover seed={seed} />);

it("draws the same cover for the same seed and a different one for another seed", () => {
  expect(markup("course-a")).toBe(markup("course-a"));
  expect(markup("course-a")).not.toBe(markup("course-b"));
});

it("is decorative, themed through currentColor and has drawn paths", () => {
  const html = markup("course-a");
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain("<path");
  expect(html).toContain('stroke="currentColor"');
  expect(html).not.toMatch(/#[0-9a-f]{3,6}/i);
});

it("renders for an empty seed", () => {
  expect(markup("")).toContain("<path");
});
