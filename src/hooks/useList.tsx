// ─────────────────────────────────────────────
//  FlexDB React SDK · useList
//  Paginated list hook. Supports "load more" / infinite scroll.
//  data accumulates across pages — never resets on fetchMore.
// ─────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from "react";

import { useFlexDB }           from "../context.tsx";
import type { PaginatedState } from "../core/types.tsx";

export interface UseListOptions {
  /** Namespace override. Falls back to the provider-level default. */
  namespace?: string;
  /** Items per page. Max 100. @default 20 */
  limit?:     number;
  /**
   * When `false`, the hook will NOT auto-fetch on mount.
   * @default true
   */
  enabled?:   boolean;
}

/**
 * Lists item **keys** (IDs) in the namespace with built-in pagination.
 *
 * - `fetch()` resets to the first page and replaces `data`.
 * - `fetchMore()` appends the next page to existing `data`.
 * - `hasMore` tells you whether another page is available.
 *
 * @example
 * ```tsx
 * function UserList() {
 *   const { data, loading, error, hasMore, fetchMore } = useList({
 *     namespace: "users",
 *     limit:     20,
 *   });
 *
 *   return (
 *     <>
 *       <ul>
 *         {data?.map(id => <li key={id}>{id}</li>)}
 *       </ul>
 *       {loading  && <Spinner />}
 *       {error    && <p>{error.message}</p>}
 *       {hasMore  && <button onClick={fetchMore}>Load more</button>}
 *     </>
 *   );
 * }
 * ```
 */
export function useList(options?: UseListOptions): PaginatedState<string> {
  const client    = useFlexDB();
  const namespace = options?.namespace;
  const limit     = options?.limit;
  const enabled   = options?.enabled ?? true;

  const [data,    setData]    = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<PaginatedState<string>["error"]>(null);
  const [cursor,  setCursor]  = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  // Track the current cursor in a ref so fetchMore always uses the latest value
  const cursorRef = useRef<string | undefined>(undefined);
  cursorRef.current = cursor;

  const nsRef    = useRef(namespace);
  nsRef.current  = namespace;
  const limitRef = useRef(limit);
  limitRef.current = limit;

  // ── Fetch first page ───────────────────────────────────────────────────────

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await client.list({
        namespace: nsRef.current,
        limit:     limitRef.current,
        cursor:    undefined, // always reset to page 1
        hydrate:   false,
      });

      setData(response.ids);
      setCursor(response.nextCursor);
      setHasMore(!!response.nextCursor);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [client]);

  // ── Fetch next page (append) ───────────────────────────────────────────────

  const fetchMore = useCallback(async () => {
    if (!cursorRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const response = await client.list({
        namespace: nsRef.current,
        limit:     limitRef.current,
        cursor:    cursorRef.current,
        hydrate:   false,
      });

      setData(prev => [...(prev ?? []), ...response.ids]);
      setCursor(response.nextCursor);
      setHasMore(!!response.nextCursor);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [client]);

  // ── Auto-fetch on mount ────────────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;
    fetch();
  }, [namespace, limit, enabled, fetch]);

  return { data, loading, error, cursor, hasMore, fetch, fetchMore };
}

// ─────────────────────────────────────────────────────────────────────────────
//  useListHydrated
//  Same as useList but returns full objects instead of IDs.
//  Requires limit <= 20 (server constraint for optimal speed).
// ─────────────────────────────────────────────────────────────────────────────

export interface UseListHydratedOptions {
  namespace?: string;
  /** Max 20 (server constraint for hydrated responses). @default 20 */
  limit?:     number;
  enabled?:   boolean;
}

/**
 * Lists items and returns their full data (not just IDs).
 * The server only supports hydration when `limit` ≤ 20.
 * This constraint is not enforced in `useList` to allow larger batch sizes when hydration is not needed.
 *
 * @example
 * ```tsx
 * function UserCards() {
 *   const { data, loading, hasMore, fetchMore } = useListHydrated<User>({
 *     namespace: "users",
 *     limit:     20,
 *   });
 *
 *   return (
 *     <>
 *       {data?.map(({ id, data: user }) => (
 *         <UserCard key={id} user={user} />
 *       ))}
 *       {hasMore && <button onClick={fetchMore}>Load more</button>}
 *     </>
 *   );
 * }
 * ```
 */
export function useListHydrated<T = unknown>(
  options?: UseListHydratedOptions,
): PaginatedState<{ id: string; data: T | null }> {
  const client    = useFlexDB();
  const namespace = options?.namespace;
  const limit     = Math.min(options?.limit ?? 20, 20); // enforce server cap
  const enabled   = options?.enabled ?? true;

  const [data,    setData]    = useState<{ id: string; data: T | null }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<PaginatedState<{ id: string; data: T | null }>["error"]>(null);
  const [cursor,  setCursor]  = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  const cursorRef   = useRef<string | undefined>(undefined);
  cursorRef.current = cursor;
  const nsRef       = useRef(namespace);
  nsRef.current     = namespace;

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await client.list<T>({
        namespace: nsRef.current,
        limit,
        cursor:    undefined,
        hydrate:   true,
      });
      setData(response.items);
      setCursor(response.nextCursor);
      setHasMore(!!response.nextCursor);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [client, limit]);

  const fetchMore = useCallback(async () => {
    if (!cursorRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const response = await client.list<T>({
        namespace: nsRef.current,
        limit,
        cursor:    cursorRef.current,
        hydrate:   true,
      });
      setData(prev => [...(prev ?? []), ...response.items]);
      setCursor(response.nextCursor);
      setHasMore(!!response.nextCursor);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [client, limit]);

  useEffect(() => {
    if (!enabled) return;
    fetch();
  }, [namespace, limit, enabled, fetch]);

  return { data, loading, error, cursor, hasMore, fetch, fetchMore };
}