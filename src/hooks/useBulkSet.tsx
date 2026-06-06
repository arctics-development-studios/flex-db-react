/**
 * React hook for bulk-upserting up to 50 FlexDB items in a single request.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useBulkSet
//  Upserts up to 50 items in parallel at caller-supplied keys.
//  Fully replaces existing values — not a partial merge.
//  Delegates to FlexDBClient.bulkSet() from @arctics/flex-db-sdk.
// ─────────────────────────────────────────────

import { useState, useCallback } from "react";

import { useFlexDB }                         from "../context.tsx";
import type { SearchParams, BulkSetResult, UseMutationState } from "../core/types.tsx";

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
   * Maximum 50 items per call (`ERR_BULK_TOO_LARGE` if exceeded).
   */
  items: Array<{
    /** The key to store the item under. Created if absent; fully replaced if it exists. */
    key:  string;
    /** Any JSON-serialisable value. Fully replaces any previously stored value. */
    data: unknown;
    /** Fully replaces the previously stored search parameters for this key. */
    sp?: SearchParams;
  }>;
  /** Per-call namespace override. Falls back to the hook-level then provider default. */
  namespace?: string;
}

/**
 * Upserts up to 50 items in a single parallel request at **caller-supplied** keys.
 *
 * Each item fully replaces any previously stored value at its key.
 * This is **not** a partial merge.
 *
 * `execute` returns {@link BulkSetResult} with per-item `{ ok, error? }` results
 * in the same order as `items`.
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
 *   return (
 *     <>
 *       {error && <p>{error.message}</p>}
 *       <button
 *         onClick={() => execute({
 *           items: users.map(u => ({
 *             key:  u.id,
 *             data: { name: u.name, age: u.age },
 *             sp:   { role: u.role },
 *           })),
 *         })}
 *         disabled={loading}
 *       >
 *         {loading ? "Syncing…" : "Sync all"}
 *       </button>
 *     </>
 *   );
 * }
 * ```
 */
export function useBulkSet(
  options?: UseBulkSetOptions,
): UseMutationState<BulkSetArgs, BulkSetResult> {
  const client = useFlexDB();

  const [data,    setData]    = useState<BulkSetResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<UseMutationState<BulkSetArgs, BulkSetResult>["error"]>(null);

  const execute = useCallback(async (args: BulkSetArgs): Promise<BulkSetResult> => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.bulkSet(
        args.items.map(i => ({ key: i.key, data: i.data, sp: i.sp })),
        { namespace: args.namespace ?? options?.namespace },
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
