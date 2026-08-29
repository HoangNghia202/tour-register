import type { PostgrestError } from "@supabase/supabase-js";

type RowRecord = Record<string, unknown>;

interface Rangeable {
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: PostgrestError | null }>;
}

const PAGE_SIZE = 1000;

/**
 * PostgREST caps every response at `db.max_rows` (Supabase default: 1000), so a
 * plain `.select("*")` silently returns only the first 1000 rows. This pages
 * through the query with `.range()` until every row has been fetched.
 *
 * `makeQuery` must return a FRESH builder on each call and should include a
 * stable `.order(...)` (ideally ending on a unique column) so paging never skips
 * or duplicates rows.
 */
export async function fetchAllRows(
  makeQuery: () => Rangeable,
): Promise<{ data: RowRecord[]; error: PostgrestError | null }> {
  const rows: RowRecord[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery().range(from, from + PAGE_SIZE - 1);

    if (error) {
      // PGRST103: "Requested range not satisfiable" — `from` is past the last
      // row (happens when the total is an exact multiple of PAGE_SIZE).
      if (error.code === "PGRST103") break;
      return { data: rows, error };
    }

    const batch = (data as RowRecord[] | null) ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return { data: rows, error: null };
}
