/**
 * React hook for creating new FlexDB items with server-generated keys.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useCreate
//  Mutation hook for creating items with server-generated NanoID keys.
//  Delegates to FlexDBClient.create() from @arctics/flex-db-sdk.
// ─────────────────────────────────────────────

import { useState, useCallback } from "react";

import { useFlexDB }                       from "../context.tsx";
import type { SearchParams, CreateResult, UseMutationState } from "../core/types.tsx";

/**
 * Options for {@link useCreate}.
 */
export interface UseCreateOptions {
  /**
   * Namespace override for this hook.
   * Falls back to the namespace set on {@link FlexDBProvider}.
   */
  namespace?: string;
}

/**
 * Arguments passed to the `execute` function returned by {@link useCreate}.
 */
export interface CreateArgs {
  /**
   * The data to store. Any JSON-serialisable value.
   *
   * @example
   * ```ts
   * { name: "Alice", age: 30 }
   * ```
   */
  value:  unknown;
  /**
   * Fields to index as searchable properties (`sp`).
   * These power all {@link useSearch} / {@link useSearchHydrated} queries.
   * Only listed fields are queryable — values must be string, number, or boolean.
   *
   * @example
   * ```ts
   * sp: { age: 30, role: "admin" }
   * ```
   */
  sp?: SearchParams;
}

/**
 * Mutation hook for creating a new item with a **server-generated** NanoID key.
 *
 * Returns an `execute` function you call in response to a user action. All
 * state — `data`, `loading`, `error` — updates automatically so your UI
 * re-renders with the result.
 *
 * `execute` returns {@link CreateResult} with the server-generated `key`.
 * Store it — it is the only way to retrieve or delete this item later.
 *
 * @param options - Optional namespace override. See {@link UseCreateOptions}.
 * @returns {@link UseMutationState} with `execute`, `reset`, `data`, `loading`, and `error`.
 *
 * @example Basic form with status feedback
 * ```tsx
 * import { useCreate } from "@arctics/flex-db-react";
 *
 * function CreateUserForm() {
 *   const { execute, loading, data, error } = useCreate({ namespace: "users" });
 *
 *   const handleSubmit = async (form: UserForm) => {
 *     const { key } = await execute({
 *       value: { name: form.name, age: form.age },
 *       sp:    { age: form.age, role: form.role },
 *     });
 *     console.log("Created with key:", key);
 *   };
 *
 *   return (
 *     <>
 *       {error && <p className="error">{error.message}</p>}
 *       {data  && <p>Saved! Key: {data.key}</p>}
 *       <button onClick={handleSubmit} disabled={loading}>
 *         {loading ? "Saving…" : "Save"}
 *       </button>
 *     </>
 *   );
 * }
 * ```
 */
export function useCreate(
  options?: UseCreateOptions,
): UseMutationState<CreateArgs, CreateResult> {
  const client    = useFlexDB();
  const namespace = options?.namespace;

  const [data,    setData]    = useState<CreateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<UseMutationState<CreateArgs, CreateResult>["error"]>(null);

  const execute = useCallback(
    async (args: CreateArgs): Promise<CreateResult> => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.create(args.value, { namespace, sp: args.sp });
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
