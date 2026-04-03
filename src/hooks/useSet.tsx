/**
 * React hook for upserting FlexDB items at caller-supplied keys.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useSet
//  Mutation hook for upserting items at a caller-supplied key.
// ─────────────────────────────────────────────

import { useState, useCallback } from "react";

import { useFlexDB }             from "../context.tsx";
import type { SearchParams, UseMutationState, SetResponse } from "../core/types.tsx";

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
   * Any non-empty string is valid. If the key already exists, the stored
   * value is **replaced entirely** — this is not a partial patch.
   *
   * @example
   * ```ts
   * key: "user-42"          // your own ID scheme
   * key: crypto.randomUUID() // UUID
   * ```
   */
  key:           string;
  /**
   * The data to store. Any JSON-serialisable object or value.
   * Replaces the full stored value if the key already exists.
   */
  value:         unknown;
  /**
   * Fields to index for future {@link useSearch} / {@link useSearchHydrated} calls.
   *
   * These are stored **separately** from `value` and power all filter queries.
   * Updating `searchParams` on a re-write fully replaces the previous index
   * entries for this key.
   *
   * @example
   * ```ts
   * searchParams: { age: 26, role: "admin" }
   * ```
   */
  searchParams?: SearchParams;
}

/**
 * Mutation hook for **upserting** (create-or-overwrite) an item at a
 * caller-supplied key.
 *
 * - If the key does **not** exist, a new item is created.
 * - If the key **already** exists, the stored value is replaced entirely.
 *   This is not a partial update — pass the full object every time.
 *
 * Use {@link useSet} when you control the key (e.g. storing a record under a
 * user's UUID or a human-readable slug). For server-generated keys, use
 * {@link useCreate} instead.
 *
 * The `execute` function is memoised with `useCallback` and is stable across
 * renders — safe to pass as a prop or use as an effect dependency.
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
 *   const handleSave = (formData: UserForm) =>
 *     execute({
 *       key:          userId,
 *       value:        { name: formData.name, age: formData.age },
 *       searchParams: { age: formData.age, role: formData.role },
 *     });
 *
 *   return (
 *     <>
 *       {error && <p className="error">{error.message}</p>}
 *       <button onClick={() => handleSave(...)} disabled={loading}>
 *         {loading ? "Saving…" : "Save"}
 *       </button>
 *     </>
 *   );
 * }
 * ```
 *
 * @example Idempotent write — safe to call multiple times
 * ```tsx
 * const { execute } = useSet({ namespace: "settings" });
 *
 * // Writing the same key twice is safe — second call just overwrites
 * await execute({ key: "theme", value: { mode: "dark" } });
 * await execute({ key: "theme", value: { mode: "light" } });
 * // Stored value is now { mode: "light" }
 * ```
 *
 * @example Resetting after success
 * ```tsx
 * const { execute, reset, data } = useSet({ namespace: "users" });
 *
 * useEffect(() => {
 *   if (!data) return;
 *   const t = setTimeout(reset, 2000); // clear success state after 2 s
 *   return () => clearTimeout(t);
 * }, [data, reset]);
 * ```
 */
export function useSet(
  options?: UseSetOptions,
): UseMutationState<SetArgs, SetResponse> {
  const client    = useFlexDB();
  const namespace = options?.namespace;

  const [data,    setData]    = useState<SetResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<UseMutationState<SetArgs, SetResponse>["error"]>(null);

  const execute = useCallback(
    async (args: SetArgs): Promise<SetResponse> => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.set(args.key, args.value, namespace, args.searchParams);
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