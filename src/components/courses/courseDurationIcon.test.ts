import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const components = [
  ["PublicCourseCard", new URL("./PublicCourseCard.tsx", import.meta.url)],
  [
    "ContinueLearningSection",
    new URL("../../pages/home/components/ContinueLearningSection.tsx", import.meta.url),
  ],
  [
    "ExploreCoursesSection",
    new URL("../../pages/home/components/ExploreCoursesSection.tsx", import.meta.url),
  ],
  ["SearchPage", new URL("../../pages/search/SearchPage.tsx", import.meta.url)],
] as const;

describe.each(components)("%s course duration icon", (_name, fileUrl) => {
  const source = readFileSync(fileUrl, "utf8");

  it("uses the Phosphor TimerIcon with duotone weight", () => {
    expect(source).toMatch(
      /import\s*\{[^}]*\bTimerIcon\b[^}]*\}\s*from\s*"@phosphor-icons\/react"/,
    );
    expect(source).toMatch(/<TimerIcon\b[^>]*\bweight="duotone"/);
  });
});

describe("PublicCourseCard thumbnail placeholder icon", () => {
  const source = readFileSync(new URL("./PublicCourseCard.tsx", import.meta.url), "utf8");

  it("uses the Phosphor BookOpen icon with duotone weight", () => {
    expect(source).toMatch(
      /import\s*\{[^}]*\bBookOpen\b[^}]*\}\s*from\s*"@phosphor-icons\/react"/,
    );
    expect(source).toMatch(/<BookOpen\b[^>]*\bweight="duotone"/);
  });
});
