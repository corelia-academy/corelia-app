import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
const service = vi.hoisted(() => ({ getPublicProfileById: vi.fn(async () => ({ id: "teacher" })), getPublishedCoursesByInstructor: vi.fn(async (_id: string, locale: string) => [{ title: locale }]) }));
vi.mock("@/lib/courses", () => ({ getCourse: vi.fn(), getCoursesForManagement: vi.fn(), getPublishedCoursesByInstructor: service.getPublishedCoursesByInstructor }));
vi.mock("@/lib/profile", () => ({ getPublicProfileById: service.getPublicProfileById }));
import { publicInstructorDetailQueryOptions } from "./instructorQueries";
describe("public instructor language switching", () => {
 it("keeps cached English and Vietnamese course lists separate without refetching on return", async () => {
  const client = new QueryClient();
  const english = await client.fetchQuery(publicInstructorDetailQueryOptions("teacher", true, "en-US"));
  const vietnamese = await client.fetchQuery(publicInstructorDetailQueryOptions("teacher", true, "vi-VN"));
  const englishAgain = await client.fetchQuery(publicInstructorDetailQueryOptions("teacher", true, "en"));
  expect(english.courses[0].title).toBe("en");
  expect(vietnamese.courses[0].title).toBe("vi");
  expect(englishAgain).toEqual(english);
  expect(service.getPublishedCoursesByInstructor).toHaveBeenCalledTimes(2);
 });
});
