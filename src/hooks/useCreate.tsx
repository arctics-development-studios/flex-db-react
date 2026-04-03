// ─────────────────────────────────────────────
//  FlexDB React SDK · useCreate
//  Mutation hook for creating items.
//  Returns an `execute` function — call it on user action.
// ─────────────────────────────────────────────

import { useState, useCallback } from "react";

import { useFlexDB }               from "../context.tsx";
import type { SearchParams, UseMutationState, CreateResponse } from "../core/types.tsx";

export interface UseCreateOptions {
  /** Namespace override. Falls back to the provider-level default. */
  namespace?: string;
}

export interface CreateArgs {
  /** The data to store. Any JSON-serialisable object. */
  value:        unknown;
  /** Fields to index for future `search()` calls. */
  searchParams?: SearchParams;
}

/**
 * Mutation hook for creating a new item with a server-generated key.
 *
 * Returns an `execute` function you call on user action (form submit, button
 * click, etc.). State updates automatically — your UI re-renders with the result.
 *
 * @example
 * ```tsx
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
 *     <form onSubmit={...}>
 *       {error && <p>{error.message}</p>}
 *       {data  && <p>Saved! Key: {data.key}</p>}
 *       <button disabled={loading}>
 *         {loading ? "Saving…" : "Save"}
 *       </button>
 *     </form>
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