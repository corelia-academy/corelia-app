import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";
import { isRankingStale } from "./ranking.ts";
import { sourceMark } from "./ranking_run.ts";

function query(data: Record<string, unknown> | null) {
  const q: Record<string, any> = {};
  for (const method of ["select", "in", "order", "limit"]) q[method] = vi.fn(() => q);
  q.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  return q;
}

function dbWithMarks(marks: {
  finishedAt: string | null;
  manualAt?: string | null;
  courseUpdatedAt?: string | null;
  pathUpdatedAt?: string | null;
}) {
  const queries = {
    studio_catalog_jobs: query(marks.finishedAt === null ? null : { finished_at: marks.finishedAt }),
    studio_catalog_manual_orders: query(marks.manualAt ? { created_at: marks.manualAt } : null),
    studio_courses: query(marks.courseUpdatedAt ? { updated_at: marks.courseUpdatedAt } : null),
    studio_course_paths: query(marks.pathUpdatedAt ? { updated_at: marks.pathUpdatedAt } : null),
  };
  const db = { from: vi.fn((table: keyof typeof queries) => queries[table]) } as unknown as SupabaseClient;
  return { db, queries };
}

describe("sourceMark course freshness", () => {
  it("reranks when only studio_courses.updated_at is newer", async () => {
    const jobAt = "2026-10-24T10:00:00.000000+00:00";
    const courseAt = "2026-10-24T10:00:00.000001+00:00";
    const { db, queries } = dbWithMarks({
      finishedAt: jobAt,
      manualAt: "2026-10-24T09:00:00.000000+00:00",
      courseUpdatedAt: courseAt,
      pathUpdatedAt: "2026-10-24T09:30:00.000000+00:00",
    });

    const mark = await sourceMark(db);

    expect(mark).toBe(courseAt);
    expect(isRankingStale(mark, { source_as_of: jobAt })).toBe(true);
    expect(queries.studio_courses.order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });

  it("reranks when only studio_course_paths.updated_at is newer", async () => {
    const jobAt = "2026-10-24T10:00:00.000000+00:00";
    const pathAt = "2026-10-24T10:00:00.000001+00:00";
    const { db, queries } = dbWithMarks({
      finishedAt: jobAt,
      manualAt: "2026-10-24T09:00:00.000000+00:00",
      courseUpdatedAt: "2026-10-24T09:30:00.000000+00:00",
      pathUpdatedAt: pathAt,
    });

    const mark = await sourceMark(db);

    expect(mark).toBe(pathAt);
    expect(isRankingStale(mark, { source_as_of: jobAt })).toBe(true);
    expect(queries.studio_course_paths.order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });

  it("does not rerank when course and path timestamps are not newer than the finished job", async () => {
    const jobAt = "2026-10-24T10:00:00.000000+00:00";
    const { db } = dbWithMarks({
      finishedAt: jobAt,
      manualAt: "2026-10-24T09:00:00.000000+00:00",
      courseUpdatedAt: "2026-10-24T09:30:00.000000+00:00",
      pathUpdatedAt: "2026-10-24T10:00:00.000000+00:00",
    });

    const mark = await sourceMark(db);

    expect(mark).toBe(jobAt);
    expect(isRankingStale(mark, { source_as_of: jobAt })).toBe(false);
  });

  it("keeps the mark null when no research job has finished, even if other rows are newer", async () => {
    const { db } = dbWithMarks({
      finishedAt: null,
      manualAt: "2026-10-24T12:00:00.000000+00:00",
      courseUpdatedAt: "2026-10-24T13:00:00.000000+00:00",
      pathUpdatedAt: "2026-10-24T14:00:00.000000+00:00",
    });

    const mark = await sourceMark(db);

    expect(mark).toBeNull();
    expect(isRankingStale(mark, { source_as_of: null })).toBe(false);
  });
});
