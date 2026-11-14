// PostgREST returns at most max_rows (1000) rows per request and does not say when it cut a list.
// Lists that grow with the catalog are read page by page.
const PAGE_SIZE = 500;

export interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** `page` runs the query for rows from..to (inclusive, as .range()) in a deterministic order. */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  size = PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0;; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < size) return rows;
  }
}
