/**
 * React hook for bulk-creating up to 50 FlexDB items in a single request.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useBulkCreate
//  Creates up to 50 items in parallel with server-generated keys.
// ─────────────────────────────────────────────

import { useState, useCallback } from "react";

import { useFlexDB }                from "../context.tsx";
import type {
  SearchParams,
  BulkCreateResponse,
  UseMutationState,
} from "../core/types.tsx";

/**
 * Options for {@link useBulkCreate}.
 */
export interface UseBulkCreateOptions {
  /**
   * Namespace override for this hook.
   * Falls back to the namespace set on {@link FlexDBProvider}.
   */
  namespace?: string;
}

/**
 * Arguments passed to `execute` in {@link useBulkCreate}.
 */
export interface BulkCreateArgs {
  /**
   * Array of items to create. Each receives a server-generated NanoID key.
   * Maximum 50 items per call.
   */
  items: Array<{
    /** Any JSON-serialisable value to store. */
    value:         unknown;
    /** Key-value pairs to index for future search queries. */
    searchParams?: SearchParams;
  }>;
  /** Per-call namespace override. Falls back to the hook-level then provider default. */
  namespace?: string;
}

/**
 * Creates up to 50 items in a single parallel request, each with a
 * **server-generated** NanoID key.
 *
 * All items are validated upfront before any writes begin. If any item's
 * `data` exceeds 5 MB, the entire request is rejected with
 * `ERR_REQUEST_TOO_LARGE`. If the `items` array exceeds 50, the request
 * is rejected with `ERR_BULK_TOO_LARGE`.
 *
 * `execute` returns a `BulkCreateResponse` containing the generated keys in
 * the same order as `items`. Store these keys — they are the only way to
 * retrieve or delete the created items.
 *
 * `execute` is memoised with `useCallback` and stays stable across renders.
 * On failure, `execute` sets `error` state **and** re-throws.
 *
 * @param options - Namespace override. See {@link UseBulkCreateOptions}.
 * @returns {@link UseMutationState} with `execute`, `data`, `loading`, `error`, and `reset`.
 *
 * @example Import a batch of records
 * ```tsx
 * import { useBulkCreate } from "@arctics/flex-db-react";
 *
 * function ImportButton({ records }: { records: UserRecord[] }) {
 *   const { execute, loading, data, error } = useBulkCreate({ namespace: "users" });
 *
 *   const handleImport = async () => {
 *     const { keys } = await execute({
 *       items: records.map(r => ({
 *         value:        { name: r.name, age: r.age },
 *         searchParams: { age: r.age, role: r.role },
 *       })),
 *     });
 *     console.log("Created keys:", keys);
 *   };
 *
 *   return (
 *     <>
 *       {error && <p className="error">{error.message}</p>}
 *       {data  && <p>Created {data.keys.length} items.</p>}
 *       <button onClick={handleImport} disabled={loading}>
 *         {loading ? "Importing…" : "Import"}
 *       </button>
 *     </>
 *   );
 * }
 * ```
 */
export function useBulkCreate(
  options?: UseBulkCreateOptions,
): UseMutationState<BulkCreateArgs, BulkCreateResponse> {
  const client = useFlexDB();

  const [data,    setData]    = useState<BulkCreateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<UseMutationState<BulkCreateArgs, BulkCreateResponse>["error"]>(null);

  const execute = useCallback(async (args: BulkCreateArgs): Promise<BulkCreateResponse> => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.bulkCreate(
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
