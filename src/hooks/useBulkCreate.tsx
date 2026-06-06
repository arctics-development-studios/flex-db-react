/**
 * React hook for bulk-creating up to 50 FlexDB items in a single request.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useBulkCreate
//  Creates up to 50 items in parallel with server-generated NanoID keys.
//  Delegates to FlexDBClient.bulkCreate() from @arctics/flex-db-sdk.
// ─────────────────────────────────────────────

import { useState, useCallback } from "react";

import { useFlexDB }                           from "../context.tsx";
import type { SearchParams, BulkCreateResult, UseMutationState } from "../core/types.tsx";

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
   * Maximum 50 items per call (`ERR_BULK_TOO_LARGE` if exceeded).
   */
  items: Array<{
    /** Any JSON-serialisable value to store. */
    data: unknown;
    /** Key-value pairs to index as searchable properties. */
    sp?: SearchParams;
  }>;
  /** Per-call namespace override. Falls back to the hook-level then provider default. */
  namespace?: string;
}

/**
 * Creates up to 50 items in a single parallel request, each with a
 * **server-generated** NanoID key.
 *
 * `execute` returns {@link BulkCreateResult} containing per-item results in
 * the same order as `items`. Each result has `ok`, and `id` on success.
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
 *     const { items } = await execute({
 *       items: records.map(r => ({
 *         data: { name: r.name, age: r.age },
 *         sp:   { age: r.age, role: r.role },
 *       })),
 *     });
 *     const keys = items.filter(i => i.ok).map(i => i.id!);
 *     console.log("Created keys:", keys);
 *   };
 *
 *   return (
 *     <>
 *       {error && <p className="error">{error.message}</p>}
 *       {data  && <p>Created {data.items.filter(i => i.ok).length} items.</p>}
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
): UseMutationState<BulkCreateArgs, BulkCreateResult> {
  const client = useFlexDB();

  const [data,    setData]    = useState<BulkCreateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<UseMutationState<BulkCreateArgs, BulkCreateResult>["error"]>(null);

  const execute = useCallback(async (args: BulkCreateArgs): Promise<BulkCreateResult> => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.bulkCreate(
        args.items.map(i => ({ data: i.data, sp: i.sp })),
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
