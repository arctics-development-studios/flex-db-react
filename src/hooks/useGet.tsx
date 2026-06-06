/**
 * React hook for fetching a single FlexDB item by key.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useGet
//  Fetches a single item by key. Auto-runs on mount
//  and whenever key or namespace changes.
//  Cancels in-flight requests on unmount.
//  Delegates to FlexDBClient.get() from @arctics/flex-db-sdk.
// ─────────────────────────────────────────────

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

import { useFlexDB }       from "../context.tsx";
import type { UseGetState } from "../core/types.tsx";

/**
 * Options for {@link useGet}.
 */
export interface UseGetOptions {
  /**
   * Namespace override for this hook.
   * Falls back to the namespace set on {@link FlexDBProvider}.
   */
  namespace?: string;
  /**
   * When `false`, the hook will **not** auto-fetch on mount or when `key`
   * changes. Call `refetch()` manually to trigger the first fetch.
   *
   * Useful when you want to defer loading until a condition is met.
   *
   * @default true
   *
   * @example
   * ```tsx
   * const { data } = useGet(userId, { enabled: isModalOpen });
   * ```
   */
  enabled?: boolean;
}

/**
 * Fetches a single item by key and keeps your component in sync.
 *
 * - **Auto-fetches** on mount and whenever `key` or `namespace` changes.
 * - **Cancels** the in-flight request when the component unmounts.
 * - **Preserves `data`** across re-fetches so the UI never flashes to empty.
 * - **Deferred fetching** is supported via `enabled: false` + manual `refetch()`.
 *
 * Pass the data type as a generic parameter for a fully-typed `data` field:
 * ```tsx
 * const { data } = useGet<User>(userId);
 * // data is `User | null`
 * ```
 *
 * @param key     - The item key to fetch. Pass `null` or `undefined` to skip.
 * @param options - Namespace override and `enabled` flag. See {@link UseGetOptions}.
 * @returns {@link UseGetState} with `data`, `loading`, `error`, and `refetch`.
 *
 * @example Basic usage
 * ```tsx
 * import { useGet } from "@arctics/flex-db-react";
 *
 * function UserCard({ userId }: { userId: string }) {
 *   const { data, loading, error, refetch } = useGet<User>(userId, {
 *     namespace: "users",
 *   });
 *
 *   if (loading) return <Spinner />;
 *   if (error)   return <p>Error: {error.message}</p>;
 *
 *   return (
 *     <div>
 *       <p>{data?.name}</p>
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Skip fetch until an ID is known
 * ```tsx
 * const { userId } = useAuth(); // may be null before login
 * const { data } = useGet<User>(userId); // no fetch while userId is null
 * ```
 */
export function useGet<T = unknown>(
  key:      string | null | undefined,
  options?: UseGetOptions,
): UseGetState<T> {
  const client    = useFlexDB();
  const enabled   = options?.enabled ?? true;
  const namespace = options?.namespace;

  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<UseGetState<T>["error"]>(null);

  // Stable refs so the fetch closure always sees the latest key/ns
  const keyRef = useRef(key);
  const nsRef  = useRef(namespace);
  keyRef.current = key;
  nsRef.current  = namespace;

  const fetchData = useCallback(
    async (signal: AbortSignal) => {
      const currentKey = keyRef.current;
      if (!currentKey) return;

      setLoading(true);
      setError(null);

      try {
        const result = await client.get<T>(currentKey, { namespace: nsRef.current, signal });
        setData(result.data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err as Error);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [client],
  );

  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(() => {
    abortRef.current?.abort();
    const controller  = new AbortController();
    abortRef.current  = controller;
    fetchData(controller.signal);
  }, [fetchData]);

  useEffect(() => {
    if (!enabled || !key) return;

    const controller  = new AbortController();
    abortRef.current  = controller;
    fetchData(controller.signal);

    return () => { controller.abort(); };
  }, [key, namespace, enabled, fetchData]);

  return { data, loading, error, refetch };
}
