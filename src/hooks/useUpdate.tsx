/**
 * React hook for performing a partial (shallow merge) update on all items matching a filter.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useUpdate
//  Batch partial-update hook — merges patch into all items matching filters.
//  Paginated: inspect cursor in the result to process subsequent pages.
// ─────────────────────────────────────────────

import { useState, useCallback } from "react";

import { useFlexDB }                from "../context.tsx";
import type {
  SearchParams,
  Filters,
  UpdateByFilterResponse,
  UseMutationState,
} from "../core/types.tsx";

export type { Filters };

/**
 * Options for {@link useUpdate}.
 */
export interface UseUpdateOptions {
  /**
   * Namespace override for this hook.
   * Falls back to the namespace set on {@link FlexDBProvider}.
   */
  namespace?: string;
}

/**
 * Arguments passed to `execute` in {@link useUpdate}.
 */
export interface UpdateArgs {
  /**
   * Filter conditions evaluated server-side. All conditions are AND-ed.
   * At least one filter must be present — unfiltered updates are not permitted.
   * Use the same filter syntax as {@link useSearch}.
   */
  filters:       Filters;
  /**
   * Fields to shallow-merge into each matching item's `data`.
   * Omit to leave existing `data` unchanged.
   */
  data?:         unknown;
  /**
   * Fields to shallow-merge into each matching item's `metadata.sp`.
   * Omit to leave existing search parameters unchanged.
   */
  searchParams?: SearchParams;
  /**
   * Pagination and batch-size options.
   */
  options?: {
    /**
     * Maximum number of items to process per call.
     * Values > 100 are silently clamped to 100 by the server.
     * @default 20
     */
    limit?:  number;
    /**
     * Cursor from a previous `execute` call. Pass this to process the next batch.
     * Omit on the first call.
     */
    cursor?: string;
  };
  /** Per-call namespace override. Falls back to the hook-level then provider default. */
  namespace?: string;
}

/**
 * Finds all items matching search filters and shallow-merges a patch into each.
 *
 * This is a **paginated mutation** — up to `options.limit` items are processed
 * per call. When the response includes a `cursor`, more matching items exist.
 * Call `execute` again with `options.cursor` set to that value to process the
 * next batch. Continue until `cursor` is absent.
 *
 * Objects that cannot be read during the operation (e.g. race-deleted between
 * matching and patching) are silently skipped and not counted in `updated`.
 *
 * `execute` is memoised with `useCallback` and stays stable across renders.
 * On failure, `execute` sets `error` state **and** re-throws.
 *
 * @param options - Namespace override. See {@link UseUpdateOptions}.
 * @returns {@link UseMutationState} with `execute`, `data`, `loading`, `error`, and `reset`.
 *
 * @example Archive all active items in a loop
 * ```tsx
 * import { useUpdate } from "@arctics/flex-db-react";
 *
 * function ArchiveAllButton() {
 *   const { execute, loading } = useUpdate({ namespace: "posts" });
 *
 *   const handleArchive = async () => {
 *     let cursor: string | undefined;
 *     do {
 *       const result = await execute({
 *         filters:      { status: { eq: "active" } },
 *         data:         { status: "archived" },
 *         searchParams: { status: "archived" },
 *         options:      { cursor },
 *       });
 *       cursor = result.cursor;
 *     } while (cursor);
 *   };
 *
 *   return (
 *     <button onClick={handleArchive} disabled={loading}>
 *       {loading ? "Archiving…" : "Archive all"}
 *     </button>
 *   );
 * }
 * ```
 */
export function useUpdate(
  options?: UseUpdateOptions,
): UseMutationState<UpdateArgs, UpdateByFilterResponse> {
  const client = useFlexDB();

  const [data,    setData]    = useState<UpdateByFilterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<UseMutationState<UpdateArgs, UpdateByFilterResponse>["error"]>(null);

  const execute = useCallback(async (args: UpdateArgs): Promise<UpdateByFilterResponse> => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.update(
        args.filters,
        { data: args.data, searchParams: args.searchParams },
        args.namespace ?? options?.namespace,
        args.options,
      );
      setData(result);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client, options?.namespace]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { execute, data, loading, error, reset };
}
