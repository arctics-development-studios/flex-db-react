/**
 * React hook for bulk-deleting up to 50 FlexDB items in a single request.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useBulkDelete
//  Deletes up to 50 items in parallel across all storage tiers.
//  Non-existent keys are silently skipped.
// ─────────────────────────────────────────────

import { useState, useCallback } from "react";

import { useFlexDB }                from "../context.tsx";
import type {
  BulkDeleteResponse,
  UseMutationState,
} from "../core/types.tsx";

/**
 * Options for {@link useBulkDelete}.
 */
export interface UseBulkDeleteOptions {
  /**
   * Namespace override for this hook.
   * Falls back to the namespace set on {@link FlexDBProvider}.
   */
  namespace?: string;
}

/**
 * Arguments passed to `execute` in {@link useBulkDelete}.
 */
export interface BulkDeleteArgs {
  /**
   * Array of object keys to permanently delete.
   * Maximum 50 keys per call. Non-existent keys are silently skipped.
   */
  keys:       string[];
  /** Per-call namespace override. Falls back to the hook-level then provider default. */
  namespace?: string;
}

/**
 * Permanently removes up to 50 items in a single parallel request.
 *
 * Each key is deleted from all storage tiers simultaneously. Non-existent
 * keys are **silently skipped** — no error is returned for missing keys.
 *
 * This operation is **irreversible**. Both item data and all associated
 * search index entries are deleted.
 *
 * `execute` is memoised with `useCallback` and stays stable across renders.
 * On failure, `execute` sets `error` state **and** re-throws.
 *
 * @param options - Namespace override. See {@link UseBulkDeleteOptions}.
 * @returns {@link UseMutationState} with `execute`, `data`, `loading`, `error`, and `reset`.
 *
 * @example Delete all selected items
 * ```tsx
 * import { useBulkDelete } from "@arctics/flex-db-react";
 *
 * function DeleteSelectedButton({ selectedKeys }: { selectedKeys: string[] }) {
 *   const { execute, loading, error } = useBulkDelete({ namespace: "users" });
 *
 *   const handleDelete = async () => {
 *     if (!confirm(`Delete ${selectedKeys.length} items?`)) return;
 *     await execute({ keys: selectedKeys });
 *   };
 *
 *   return (
 *     <>
 *       {error && <p>{error.message}</p>}
 *       <button onClick={handleDelete} disabled={loading || selectedKeys.length === 0}>
 *         {loading ? "Deleting…" : `Delete ${selectedKeys.length} items`}
 *       </button>
 *     </>
 *   );
 * }
 * ```
 */
export function useBulkDelete(
  options?: UseBulkDeleteOptions,
): UseMutationState<BulkDeleteArgs, BulkDeleteResponse> {
  const client = useFlexDB();

  const [data,    setData]    = useState<BulkDeleteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<UseMutationState<BulkDeleteArgs, BulkDeleteResponse>["error"]>(null);

  const execute = useCallback(async (args: BulkDeleteArgs): Promise<BulkDeleteResponse> => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.bulkDelete(
        args.keys,
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
