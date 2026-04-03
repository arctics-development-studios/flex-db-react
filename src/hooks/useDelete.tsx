// ─────────────────────────────────────────────
//  FlexDB React SDK · useDelete
//  Mutation hook for deleting items by key.
// ─────────────────────────────────────────────

import { useState, useCallback } from "react";

import { useFlexDB }               from "../context.tsx";
import type { UseMutationState, DeleteResponse } from "../core/types.tsx";

export interface UseDeleteOptions {
  /** Namespace override. Falls back to the provider-level default. */
  namespace?: string;
}

export interface DeleteArgs {
  /** The key of the item to remove. */
  key: string;
}

/**
 * Mutation hook for permanently removing an item.
 *
 * @example
 * ```tsx
 * function DeleteButton({ itemKey }: { itemKey: string }) {
 *   const { execute, loading, error } = useDelete({ namespace: "users" });
 *
 *   return (
 *     <>
 *       {error && <p>{error.message}</p>}
 *       <button onClick={() => execute({ key: itemKey })} disabled={loading}>
 *         {loading ? "Deleting…" : "Delete"}
 *       </button>
 *     </>
 *   );
 * }
 * ```
 */
export function useDelete(
  options?: UseDeleteOptions,
): UseMutationState<DeleteArgs, DeleteResponse> {
  const client    = useFlexDB();
  const namespace = options?.namespace;

  const [data,    setData]    = useState<DeleteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<UseMutationState<DeleteArgs, DeleteResponse>["error"]>(null);

  const execute = useCallback(
    async (args: DeleteArgs): Promise<DeleteResponse> => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.delete(args.key, namespace);
        setData(result);
        return result;
      } catch (err) {
        const e = err as Error;
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [client, namespace],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}