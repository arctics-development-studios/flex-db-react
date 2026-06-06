/**
 * React hook for upserting FlexDB items at caller-supplied keys.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useSet
//  Mutation hook for upserting items at a caller-supplied key.
//  Delegates to FlexDBClient.set() from @arctics/flex-db-sdk.
// ─────────────────────────────────────────────

import { useState, useCallback } from "react";

import { useFlexDB }                      from "../context.tsx";
import type { SearchParams, SetResult, UseMutationState } from "../core/types.tsx";

/**
 * Options for {@link useSet}.
 */
export interface UseSetOptions {
  /**
   * Namespace override for this hook.
   * Falls back to the namespace set on {@link FlexDBProvider}.
   */
  namespace?: string;
}

/**
 * Arguments passed to the `execute` function returned by {@link useSet}.
 */
export interface SetArgs {
  /**
   * The key to store the item under.
   * If the key already exists, the stored value is **fully replaced**.
   */
  key:   string;
  /**
   * The data to store. Any JSON-serialisable value.
   * Fully replaces any previously stored value.
   */
  value: unknown;
  /**
   * Fields to index as searchable properties (`sp`).
   * Fully replaces the previously stored search params for this key.
   *
   * @example
   * ```ts
   * sp: { age: 26, role: "admin" }
   * ```
   */
  sp?: SearchParams;
}

/**
 * Mutation hook for **upserting** (create-or-overwrite) an item at a
 * caller-supplied key.
 *
 * - If the key does **not** exist, a new item is created.
 * - If the key **already** exists, the stored value is replaced entirely.
 *   Pass the full object every time — this is not a partial update.
 *
 * Use {@link useCreate} when you want the server to generate the key.
 *
 * @param options - Optional namespace override. See {@link UseSetOptions}.
 * @returns {@link UseMutationState} with `execute`, `reset`, `data`, `loading`, and `error`.
 *
 * @example Edit form with upsert on save
 * ```tsx
 * import { useSet } from "@arctics/flex-db-react";
 *
 * function EditUserForm({ userId }: { userId: string }) {
 *   const { execute, loading, error } = useSet({ namespace: "users" });
 *
 *   return (
 *     <>
 *       {error && <p className="error">{error.message}</p>}
 *       <button
 *         onClick={() => execute({ key: userId, value: { name: "Alice", age: 31 } })}
 *         disabled={loading}
 *       >
 *         {loading ? "Saving…" : "Save"}
 *       </button>
 *     </>
 *   );
 * }
 * ```
 */
export function useSet(
  options?: UseSetOptions,
): UseMutationState<SetArgs, SetResult> {
  const client    = useFlexDB();
  const namespace = options?.namespace;

  const [data,    setData]    = useState<SetResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<UseMutationState<SetArgs, SetResult>["error"]>(null);

  const execute = useCallback(
    async (args: SetArgs): Promise<SetResult> => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.set(args.key, args.value, { namespace, sp: args.sp });
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
