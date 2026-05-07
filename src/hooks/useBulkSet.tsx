/**
 * React hook for bulk-upserting up to 50 FlexDB items in a single request.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useBulkSet
//  Upserts up to 50 items in parallel at caller-supplied keys.
//  Fully replaces existing values — not a partial merge.
// ─────────────────────────────────────────────

import { useState, useCallback } from "react";

import { useFlexDB }                from "../context.tsx";
import type {
  SearchParams,
  BulkSetResponse,
  UseMutationState,
} from "../core/types.tsx";

/**
 * Options for {@link useBulkSet}.
 */
export interface UseBulkSetOptions {
  /**
   * Namespace override for this hook.
   * Falls back to the namespace set on {@link FlexDBProvider}.
   */
  namespace?: string;
}

/**
 * Arguments passed to `execute` in {@link useBulkSet}.
 */
export interface BulkSetArgs {
  /**
   * Array of items to upsert. Each must supply an explicit key.
   * Maximum 50 items per call.
   */
  items: Array<{
    /** The key to store the item under. Created if absent; fully replaced if it exists. */
    key:           string;
    /** Any JSON-serialisable value. Fully replaces any previously stored value. */
    value:         unknown;
    /** Fully replaces the previously stored search parameters for this key. */
    searchParams?: SearchParams;
  }>;
  /** Per-call namespace override. Falls back to the hook-level then provider default. */
  namespace?: string;
}

/**
 * Upserts up to 50 items in a single parallel request at **caller-supplied** keys.
 *
 * Each item fully replaces any previously stored value at its key — this is
 * **not** a partial merge. Use {@link useUpdateOne} or {@link useUpdate} for
 * partial (shallow merge) updates.
 *
 * All items are validated upfront before any writes begin. If any item's
 * `data` exceeds 5 MB, the entire request is rejected with
 * `ERR_REQUEST_TOO_LARGE`. If the `items` array exceeds 50, the request
 * is rejected with `ERR_BULK_TOO_LARGE`.
 *
 * `execute` is memoised with `useCallback` and stays stable across renders.
 * On failure, `execute` sets `error` state **and** re-throws.
 *
 * @param options - Namespace override. See {@link UseBulkSetOptions}.
 * @returns {@link UseMutationState} with `execute`, `data`, `loading`, `error`, and `reset`.
 *
 * @example Sync a batch of known-key records
 * ```tsx
 * import { useBulkSet } from "@arctics/flex-db-react";
 *
 * function SyncButton({ users }: { users: User[] }) {
 *   const { execute, loading, error } = useBulkSet({ namespace: "users" });
 *
 *   const handleSync = () =>
 *     execute({
 *       items: users.map(u => ({
 *         key:          u.id,
 *         value:        { name: u.name, age: u.age },
 *         searchParams: { role: u.role },
 *       })),
 *     });
 *
 *   return (
 *     <>
 *       {error && <p>{error.message}</p>}
 *       <button onClick={handleSync} disabled={loading}>
 *         {loading ? "Syncing…" : "Sync all"}
 *       </button>
 *     </>
 *   );
 * }
 * ```
 */
export function useBulkSet(
  options?: UseBulkSetOptions,
): UseMutationState<BulkSetArgs, BulkSetResponse> {
  const client = useFlexDB();

  const [data,    setData]    = useState<BulkSetResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<UseMutationState<BulkSetArgs, BulkSetResponse>["error"]>(null);

  const execute = useCallback(async (args: BulkSetArgs): Promise<BulkSetResponse> => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.bulkSet(
        args.items,
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
