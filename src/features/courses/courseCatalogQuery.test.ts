import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  failTable: null as string | null,
}));

vi.mock("@/lib/coreliaEdgeApi", () => ({
  coreliaEdgeUrl: (name: string) => name,
  supabaseFunctionHeaders: () => ({}),
}));

// Minimal PostgREST-like builder: applies eq/in/is filters to the in-memory rows.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      const builder = {
        select: () => builder,
        order: () => builder,
        eq(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return builder;
        },
        is(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return builder;
        },
        in(column: string, values: unknown[]) {
          filters.push((row) => values.includes(row[column]));
          return builder;
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          const result =
            db.failTable === table
              ? Promise.reject(new Error("offline"))
              : Promise.resolve({
                  data: (db.tables[table] ?? []).filter((row) => filters.every((match) => match(row))),
                  error: null,
                });
          return result.then(resolve, reject);
        },
      };
      return builder;
    },
  },
}));

vi.mock("@/lib/finalAssignment", () => ({ getSubmission: vi.fn() }));
vi.mock("@/lib/hackathons", () => ({ listPublicContests: vi.fn() }));
vi.mock("@/lib/profile", () => ({ getPublicProfileById: vi.fn() }));

import { coursesCatalogQueryOptions } from "@/features/courses/courseQueries";
import { homeCatalogQueryOptions } from "@/pages/home/queries/homeQueries";

const EN_COURSE: Row = {
  id: "course-en",
  slug: "english-course",
  instructor_id: "instructor",
  published: true,
  archived_at: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-02T00:00:00Z",
  data: {
    title: "English course",
    short_description: "English summary",
    i18n: { primary_content_locale: "en", supported_locales: ["en", "vi"] },
  },
};

const VI_COURSE: Row = {
  id: "course-vi",
  slug: "legacy-vi-course",
  instructor_id: "instructor",
  published: true,
  archived_at: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-02T00:00:00Z",
  data: {
    title: "Khóa cũ",
    short_description: "Mô tả cũ",
    i18n: { primary_content_locale: "vi", supported_locales: ["vi"] },
  },
};

const EN_COURSE_VI_LOCALE: Row = {
  course_id: "course-en",
  locale: "vi",
  data: { title: "Khóa tiếng Việt", short_description: "Mô tả tiếng Việt" },
};

function seedDb() {
  db.tables = {
    courses: [EN_COURSE, VI_COURSE],
    course_locales: [EN_COURSE_VI_LOCALE],
  };
  db.failTable = null;
}

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("coursesCatalogQueryOptions", () => {
  beforeEach(() => {
    seedDb();
  });

  it("uses the vi translation for an English-primary course under vi UI and keeps the legacy vi course", async () => {
    const courses = await createClient().fetchQuery(coursesCatalogQueryOptions("vi"));
    const byId = new Map(courses.map((course) => [course.id, course]));

    expect(byId.get("course-en")).toMatchObject({
      title: "Khóa tiếng Việt",
      short_description: "Mô tả tiếng Việt",
    });
    expect(byId.get("course-vi")).toMatchObject({ title: "Khóa cũ", short_description: "Mô tả cũ" });
  });

  it("keeps the Vietnamese master copy of a legacy vi course under en UI", async () => {
    const courses = await createClient().fetchQuery(coursesCatalogQueryOptions("en"));
    const byId = new Map(courses.map((course) => [course.id, course]));

    expect(byId.get("course-vi")).toMatchObject({ title: "Khóa cũ" });
  });

  it("keeps the English master copy of an English-primary course under en UI", async () => {
    const courses = await createClient().fetchQuery(coursesCatalogQueryOptions("en"));
    const byId = new Map(courses.map((course) => [course.id, course]));

    expect(byId.get("course-en")).toMatchObject({ title: "English course", short_description: "English summary" });
  });

  it("returns master copies for every course when the locale read fails", async () => {
    db.failTable = "course_locales";
    const courses = await createClient().fetchQuery(coursesCatalogQueryOptions("vi"));

    expect(courses.map((course) => course.title)).toEqual(["English course", "Khóa cũ"]);
  });
});

describe("homeCatalogQueryOptions", () => {
  beforeEach(() => {
    seedDb();
  });

  it("localizes each course by its own primary locale, not by the first course in the list", async () => {
    // The legacy vi course is first: its locale must not decide the English course's copy.
    db.tables.courses = [VI_COURSE, EN_COURSE];
    const { courseCatalog } = await createClient().fetchQuery(homeCatalogQueryOptions(null, "en"));
    const byId = new Map(courseCatalog.map((course) => [course.id, course]));

    expect(byId.get("course-en")).toMatchObject({ title: "English course" });
    expect(byId.get("course-vi")).toMatchObject({ title: "Khóa cũ" });
  });
});
