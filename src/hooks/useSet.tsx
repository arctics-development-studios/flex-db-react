// ─────────────────────────────────────────────
//  FlexDB React SDK · useSet
//  Mutation hook for upserting items at a caller-supplied key.
// ─────────────────────────────────────────────

import { useState, useCallback } from "react";

import { useFlexDB }             from "../context.tsx";
import type { SearchParams, UseMutationState, SetResponse } from "../core/types.tsx";

export interface UseSetOptions {
  /** Namespace override. Falls back to the provider-level default. */
  namespace?: string;
}

export interface SetArgs {
  /** The key to store the item under. */
  key:          string;
  /** The data to store. Any JSON-serialisable object. */
  value:        unknown;
  /** Fields to index for future `search()` calls. */
  searchParams?: SearchParams;
}

/**
 * Mutation hook for upserting (create or overwrite) an item at a caller-supplied key.
 *
 * @example
 * ```tsx
 * function EditUserForm({ userId }: { userId: string }) {
 *   const { execute, loading, error } = useSet({ namespace: "users" });
 *
 *   const handleSave = (formData: UserForm) =>
 *     execute({
 *       key:          userId,
 *       value:        formData,
 *       searchParams: { role: formData.role },
 *     });
 *
 *   return (
 *     <button onClick={handleSave} disabled={loading}>
 *       {loading ? "Saving…" : "Save"}
 *     </button>
 *   );
 * }
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