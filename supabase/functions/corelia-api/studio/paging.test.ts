import { describe, expect, it } from "vitest";

import { fetchAllPages, type PageResult } from "./paging.ts";

const source = (n: number) => Array.from({ length: n }, (_, i) => i);
const pager = (rows: number[], failAt?: number) => {
  const calls: [number, number][] = [];
  const page = async (from: number, to: number): Promise<PageResult<number>> => {
    calls.push([from, to]);
    if (failAt === from) return { data: null, error: { message: "boom" } };
    return { data: rows.slice(from, to + 1), error: null };
  };
  return { page, calls };
};

describe("fetchAllPages", () => {
  it("joins full pages and the short last page", async () => {
    const { page, calls } = pager(source(25));
    expect(await fetchAllPages(page, 10)).toEqual(source(25));
    expect(calls).toEqual([[0, 9], [10, 19], [20, 29]]);
  });

  it("asks for one more page after an exactly full page", async () => {
    const { page, calls } = pager(source(20));
    expect(await fetchAllPages(page, 10)).toEqual(source(20));
    expect(calls.length).toBe(3);
  });

  it("returns an empty list for an empty source", async () => {
    expect(await fetchAllPages(pager([]).page, 10)).toEqual([]);
  });

  it("goes past the 1000-row cap of one request with the default page size", async () => {
    expect((await fetchAllPages(pager(source(1300)).page)).length).toBe(1300);
  });

  it("throws when a middle page fails instead of returning a partial list", async () => {
    await expect(fetchAllPages(pager(source(25), 10).page, 10)).rejects.toThrow("boom");
  });
});
