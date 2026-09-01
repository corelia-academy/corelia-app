import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const courseService = vi.hoisted(() => ({
  getCourse: vi.fn(),
  getCourseBySlug: vi.fn(),
  getCourseSections: vi.fn(),
  getCourseLessons: vi.fn(),
  getCourseLocaleContent: vi.fn(),
  getCourseSectionLocaleContentMap: vi.fn(),
  getCourseLessonLocaleContentMap: vi.fn(),
}));

vi.mock("@/lib/courses", () => ({
  ...courseService,
  applyCourseLocaleContent: (course: unknown) => course,
  applyCourseSectionLocaleContent: (section: unknown) => section,
  applyCourseLessonLocaleContent: (lesson: unknown) => lesson,
  getEnrollment: vi.fn(),
  getLessonProgressForCourse: vi.fn(),
  pickCourseContentLocale: () => "vi",
}));

vi.mock("@/lib/finalAssignment", () => ({ getSubmission: vi.fn() }));
vi.mock("@/lib/hackathons", () => ({ listContests: vi.fn() }));
vi.mock("@/lib/profile", () => ({ getPublicProfileById: vi.fn() }));

import {
  courseBundleQueryOptions,
  courseKeys,
} from "@/features/courses/courseQueries";
import type { Course } from "@/types/courses";

const COURSE_ID = "3f33aa63-b8d9-4cb9-a73e-f9dfeabaf162";
const course = {
  id: COURSE_ID,
  slug: "query-architecture",
  title: "Query architecture",
} as Course;

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe("course query contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    courseService.getCourse.mockResolvedValue(course);
    courseService.getCourseBySlug.mockResolvedValue(course);
    courseService.getCourseSections.mockResolvedValue([]);
    courseService.getCourseLessons.mockResolvedValue([]);
    courseService.getCourseLocaleContent.mockResolvedValue(null);
    courseService.getCourseSectionLocaleContentMap.mockResolvedValue(new Map());
    courseService.getCourseLessonLocaleContentMap.mockResolvedValue(new Map());
  });

  it("isolates course cache by viewer, locale and access mode", () => {
    expect(courseKeys.bundle("course", "vi", "alice", false)).not.toEqual(
      courseKeys.bundle("course", "vi", "bob", false),
    );
    expect(courseKeys.bundle("course", "vi", "alice", false)).not.toEqual(
      courseKeys.bundle("course", "en", "alice", false),
    );
    expect(courseKeys.bundle("course", "vi", "alice", false)).not.toEqual(
      courseKeys.bundle("course", "vi", "alice", true),
    );
  });

  it("deduplicates concurrent reads for the same course bundle", async () => {
    const client = createClient();
    const options = courseBundleQueryOptions({
      courseRef: COURSE_ID,
      locale: "vi",
      viewer: null,
    });

    const [first, second] = await Promise.all([
      client.fetchQuery(options),
      client.fetchQuery(options),
    ]);

    expect(first).toEqual(second);
    expect(courseService.getCourse).toHaveBeenCalledTimes(1);
    expect(courseService.getCourseSections).toHaveBeenCalledTimes(1);
    expect(courseService.getCourseLessons).toHaveBeenCalledTimes(1);
  });

  it("does not commit a cancelled bundle request to cache", async () => {
    const client = createClient();
    let resolveCourse!: (value: Course) => void;
    courseService.getCourse.mockImplementationOnce(
      () => new Promise<Course>((resolve) => (resolveCourse = resolve)),
    );
    const options = courseBundleQueryOptions({
      courseRef: COURSE_ID,
      locale: "vi",
      viewer: null,
    });
    const pending = client.fetchQuery(options);

    await Promise.resolve();
    await client.cancelQueries({ queryKey: options.queryKey });
    resolveCourse(course);

    await expect(pending).rejects.toBeDefined();
    expect(client.getQueryData(options.queryKey)).toBeUndefined();
  });
});
