/**
 * React hook for permanently removing FlexDB items by key.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useDelete
//  Mutation hook for deleting items by key.
// ─────────────────────────────────────────────

import { useState, useCallback } from "react";

import { useFlexDB }               from "../context.tsx";
import type { UseMutationState, DeleteResponse } from "../core/types.tsx";

/**
 * Options for {@link useDelete}.
 */
export interface UseDeleteOptions {
  /**
   * Namespace override for this hook.
   * Falls back to the namespace set on {@link FlexDBProvider}.
   */
  namespace?: string;
}

/**
 * Arguments passed to the `execute` function returned by {@link useDelete}.
 */
export interface DeleteArgs {
  /**
   * The key of the item to permanently remove.
   * Both the stored value and its search index entries are deleted.
   */
  key: string;
}

/**
 * Mutation hook for **permanently removing** an item from FlexDB.
 *
 * Deletion is **irreversible** — both the item data and its search index
 * entries are removed. There is no soft-delete or recycle bin.
 *
 * The `execute` function is memoised with `useCallback` and is stable across
 * renders — safe to pass as a prop or use as an effect dependency.
 *
 * @param options - Optional namespace override. See {@link UseDeleteOptions}.
 * @returns {@link UseMutationState} with `execute`, `reset`, `data`, `loading`, and `error`.
 *
 * @example Simple delete button
 * ```tsx
 * import { useDelete } from "@arctics/flex-db-react";
 *
 * function DeleteButton({ itemKey }: { itemKey: string }) {
 *   const { execute, loading, error } = useDelete({ namespace: "users" });
 *
 *   return (
 *     <>
 *       {error && <p className="error">{error.message}</p>}
 *       <button onClick={() => execute({ key: itemKey })} disabled={loading}>
 *         {loading ? "Deleting…" : "Delete"}
 *       </button>
 *     </>
 *   );
 * }
 * ```
 *
 * @example Confirm before deleting
 * ```tsx
 * function DeleteUserButton({ userId }: { userId: string }) {
 *   const { execute, loading, error } = useDelete({ namespace: "users" });
 *
 *   const handleDelete = () => {
 *     if (!confirm("Permanently delete this user?")) return;
 *     execute({ key: userId });
 *   };
 *
 *   return (
 *     <>
 *       {error && <p>{error.message}</p>}
 *       <button onClick={handleDelete} disabled={loading}>
 *         {loading ? "Deleting…" : "Delete user"}
 *       </button>
 *     </>
 *   );
 * }
 * ```
 *
 * @example Optimistic UI — remove from local list immediately
 * ```tsx
 * function UserList() {
 *   const { data: ids, fetch } = useList({ namespace: "users" });
 *   const { execute } = useDelete({ namespace: "users" });
 *
 *   const handleDelete = async (key: string) => {
 *     await execute({ key });
 *     fetch(); // refresh the list after deletion
 *   };
 *
 *   return (
 *     <ul>
 *       {ids?.map(id => (
 *         <li key={id}>
 *           {id}
 *           <button onClick={() => handleDelete(id)}>✕</button>
 *         </li>
 *       ))}
 *     </ul>
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