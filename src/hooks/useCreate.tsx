/**
 * React hook for creating new FlexDB items with server-generated keys.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useCreate
//  Mutation hook for creating items.
//  Returns an `execute` function — call it on user action.
// ─────────────────────────────────────────────

import { useState, useCallback } from "react";

import { useFlexDB }               from "../context.tsx";
import type { SearchParams, UseMutationState, CreateResponse } from "../core/types.tsx";

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
   * The data to store. Any JSON-serialisable object or value.
   *
   * @example
   * ```ts
   * { name: "Alice", age: 30, roles: ["admin"] }
   * ```
   */
  value:         unknown;
  /**
   * Fields to index for future {@link useSearch} / {@link useSearchHydrated} calls.
   *
   * These are stored **separately** from `value` and power all filter queries.
   * Only the fields you list here are queryable — unlisted fields are stored
   * but not indexed.
   *
   * @example
   * ```ts
   * searchParams: { age: 30, role: "admin", inStock: true }
   * ```
   */
  searchParams?: SearchParams;
}

/**
 * Mutation hook for creating a new item with a **server-generated** NanoID key.
 *
 * Returns an `execute` function you call in response to a user action (form
 * submit, button click, etc.). All state — `data`, `loading`, `error` — updates
 * automatically so your UI re-renders with the result.
 *
 * The `execute` function is memoised with `useCallback` and is stable across
 * renders — safe to use as an effect dependency or to pass as a prop.
 *
 * After a successful call, `data.key` holds the server-generated key. Store it
 * if you need to retrieve or delete the item later.
 *
 * To upsert at a **caller-supplied** key instead, use {@link useSet}.
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
 *   const handleSubmit = async (formData: UserForm) => {
 *     const result = await execute({
 *       value:        { name: formData.name, age: formData.age },
 *       searchParams: { age: formData.age, role: formData.role },
 *     });
 *     console.log("Created with key:", result.key);
 *   };
 *
 *   return (
 *     <form onSubmit={e => { e.preventDefault(); handleSubmit(...); }}>
 *       {error && <p className="error">{error.message}</p>}
 *       {data  && <p className="success">Saved! Key: {data.key}</p>}
 *       <button type="submit" disabled={loading}>
 *         {loading ? "Saving…" : "Save"}
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 *
 * @example Indexing fields for search
 * ```tsx
 * const { execute } = useCreate({ namespace: "products" });
 *
 * // Index price, category, and inStock so they can be filtered later
 * await execute({
 *   value:        { title: "Widget Pro", price: 49.99, category: "electronics" },
 *   searchParams: { price: 49.99, category: "electronics", inStock: true },
 * });
 * ```
 *
 * @example Resetting the form after success
 * ```tsx
 * function CreateUserForm() {
 *   const { execute, reset, data, loading, error } = useCreate({ namespace: "users" });
 *
 *   const handleSubmit = async (formData: UserForm) => {
 *     await execute({ value: formData });
 *   };
 *
 *   // Show a success message, then reset after 2 s
 *   useEffect(() => {
 *     if (!data) return;
 *     const t = setTimeout(reset, 2000);
 *     return () => clearTimeout(t);
 *   }, [data, reset]);
 *
 *   return (
 *     <>
 *       {data    && <p>✓ Saved as {data.key}</p>}
 *       {error   && <p>✗ {error.message}</p>}
 *       <button onClick={handleSubmit} disabled={loading}>Save</button>
 *     </>
 *   );
 * }
 * ```
 */
export function useCreate(
  options?: UseCreateOptions,
): UseMutationState<CreateArgs, CreateResponse> {
  const client    = useFlexDB();
  const namespace = options?.namespace;

  const [data,    setData]    = useState<CreateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<UseMutationState<CreateArgs, CreateResponse>["error"]>(null);

  const execute = useCallback(
    async (args: CreateArgs): Promise<CreateResponse> => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.create(args.value, namespace, args.searchParams);
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