// ─────────────────────────────────────────────
//  FlexDB React SDK · useGet
//  Fetches a single item by key. Auto-runs on mount
//  and whenever key or namespace changes.
//  Cancels in-flight requests on unmount.
// ─────────────────────────────────────────────

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type DependencyList,
} from "react";

import { useFlexDB } from "../context.tsx";
import type { UseGetState } from "../core/types.tsx";

export interface UseGetOptions {
  /** Namespace override. Falls back to the provider-level default. */
  namespace?: string;
  /**
   * When `false`, the hook will NOT auto-fetch on mount.
   * Useful when you want to defer until a condition is met.
   * Call `refetch()` manually to trigger it.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Fetches a single item by key and keeps your component in sync.
 *
 * - Auto-fetches on mount and whenever `key` or `namespace` changes.
 * - Cancels the in-flight request when the component unmounts (no stale updates).
 * - `data` persists across re-fetches so the UI never flashes to empty.
 *
 * @example
 * ```tsx
 * function UserCard({ userId }: { userId: string }) {
 *   const { data, loading, error, refetch } = useGet<User>(userId, {
 *     namespace: "users",
 *   });
 *
 *   if (loading) return <Spinner />;
 *   if (error)   return <Error message={error.message} />;
 *
 *   return <div>{data?.name}</div>;
 * }
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
  const [loading, setLoading] = useState<boolean>(false);
  const [error,   setError]   = useState<UseGetState<T>["error"]>(null);

  // Stable ref so the fetch closure always sees the latest key/ns
  // without adding them to useCallback's dep array
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
        const response = await client.get<T>(currentKey, nsRef.current, signal);
        setData(response.item);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    },
    [client], // client is stable for the provider's lifetime
  );

  // Public refetch — creates a fresh AbortController each time
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(() => {
    abortRef.current?.abort();
    const controller   = new AbortController();
    abortRef.current   = controller;
    fetchData(controller.signal);
  }, [fetchData]);

  // Auto-fetch on mount and when key/namespace change
  useEffect(() => {
    if (!enabled || !key) return;

    const controller = new AbortController();
    abortRef.current = controller;
    fetchData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [key, namespace, enabled, fetchData]);

  return { data, loading, error, refetch };
}