/**
 * React hook for performing a partial (shallow merge) update on a single FlexDB item.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useUpdateOne
//  Partial update hook — merges patch into an existing item.
//  Item must exist; throws ERR_NOT_FOUND if the key is absent.
// ─────────────────────────────────────────────

import { useState, useCallback } from "react";

import { useFlexDB }                from "../context.tsx";
import type {
  SearchParams,
  Filters,
  UpdateOneResponse,
  UseMutationState,
} from "../core/types.tsx";

// Re-export Filters so callers can import it from the hook module if needed
export type { Filters };

/**
 * Options for {@link useUpdateOne}.
 */
export interface UseUpdateOneOptions {
  /**
   * Namespace override for this hook.
   * Falls back to the namespace set on {@link FlexDBProvider}.
   */
  namespace?: string;
}

/**
 * Arguments passed to `execute` in {@link useUpdateOne}.
 */
export interface UpdateOneArgs {
  /** The key of the item to patch. The item must already exist. */
  key:           string;
  /**
   * Fields to shallow-merge into the existing `data`.
   * - If both existing and incoming `data` are JSON objects, keys are merged.
   * - Otherwise the existing value is replaced entirely by this value.
   * - Omit to leave existing `data` unchanged.
   */
  data?:         unknown;
  /**
   * Fields to shallow-merge into the existing `metadata.sp`.
   * Provided keys overwrite or add; unspecified sp keys are preserved.
   * Omit to leave existing search parameters unchanged.
   */
  searchParams?: SearchParams;
  /** Per-call namespace override. Falls back to the hook-level then provider default. */
  namespace?:    string;
}

/**
 * Partially updates a single item by key using a shallow merge.
 *
 * Unlike {@link useSet}, this does **not** replace the stored value — only the
 * fields you supply in `data` are overwritten; all other fields are preserved.
 * The item must already exist; if the key is not found, `execute` throws a
 * `FlexDBError` with `status === 404`.
 *
 * `execute` is memoised with `useCallback` and stays stable across renders,
 * so it is safe to pass as a prop or use as an effect dependency.
 *
 * On failure, `execute` sets `error` state **and** re-throws — wrap in
 * `try/catch` to handle failures inline.
 *
 * @param options - Namespace override. See {@link UseUpdateOneOptions}.
 * @returns {@link UseMutationState} with `execute`, `data`, `loading`, `error`, and `reset`.
 *
 * @example Increment a counter field
 * ```tsx
 * import { useUpdateOne } from "@arctics/flex-db-react";
 *
 * function LikeButton({ postKey }: { postKey: string }) {
 *   const { execute, loading } = useUpdateOne({ namespace: "posts" });
 *
 *   const handleLike = async () => {
 *     await execute({ key: postKey, data: { liked: true } });
 *   };
 *
 *   return (
 *     <button onClick={handleLike} disabled={loading}>
 *       {loading ? "Saving…" : "Like"}
 *     </button>
 *   );
 * }
 * ```
 *
 * @example Patch search params only (without touching data)
 * ```tsx
 * const { execute } = useUpdateOne({ namespace: "products" });
 *
 * await execute({
 *   key:          "prod-abc",
 *   searchParams: { status: "archived" },
 * });
 * ```
 */
export function useUpdateOne(
  options?: UseUpdateOneOptions,
): UseMutationState<UpdateOneArgs, UpdateOneResponse> {
  const client = useFlexDB();

  const [data,    setData]    = useState<UpdateOneResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<UseMutationState<UpdateOneArgs, UpdateOneResponse>["error"]>(null);

  const execute = useCallback(async (args: UpdateOneArgs): Promise<UpdateOneResponse> => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.updateOne(
        args.key,
        { data: args.data, searchParams: args.searchParams },
        args.namespace ?? options?.namespace,
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
