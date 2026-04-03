/**
 * React hooks for paginated listing of FlexDB items.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useList / useListHydrated
//  Paginated list hooks with "load more" / infinite scroll.
//  data accumulates across pages — never resets on fetchMore.
// ─────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from "react";

import { useFlexDB }           from "../context.tsx";
import type { PaginatedState } from "../core/types.tsx";

/**
 * Options for {@link useList}.
 */
export interface UseListOptions {
  /**
   * Namespace override for this hook.
   * Falls back to the namespace set on {@link FlexDBProvider}.
   */
  namespace?: string;
  /**
   * Number of item keys to return per page.
   * Max 100.
   * @default 20
   */
  limit?: number;
  /**
   * When `false`, the hook will **not** auto-fetch on mount.
   * Call `fetch()` manually to trigger the first page load.
   *
   * Useful when the list should only appear after a user action.
   *
   * @default true
   */
  enabled?: boolean;
}

/**
 * Lists item **keys** (IDs) in the namespace with built-in cursor pagination.
 *
 * - **Auto-fetches** the first page on mount (unless `enabled: false`).
 * - `fetch()` resets to page 1 and **replaces** `data`.
 * - `fetchMore()` fetches the next page and **appends** to `data`.
 * - `hasMore` is `true` when more pages are available server-side.
 * - `data` accumulates across `fetchMore` calls — it never resets between pages,
 *   so infinite-scroll works without manual list management.
 *
 * When you need full item objects instead of just IDs, use
 * {@link useListHydrated} (limit must be ≤ 20).
 *
 * @param options - Namespace, page size, and enabled flag. See {@link UseListOptions}.
 * @returns {@link PaginatedState} with `data`, `loading`, `error`, `hasMore`, `fetch`, and `fetchMore`.
 *
 * @example Infinite scroll list
 * ```tsx
 * import { useList } from "@arctics/flex-db-react";
 *
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
 *       {error    && <p className="error">{error.message}</p>}
 *       {hasMore  && (
 *         <button onClick={fetchMore} disabled={loading}>Load more</button>
 *       )}
 *     </>
 *   );
 * }
 * ```
 *
 * @example Manual refresh — re-fetch from page 1
 * ```tsx
 * function UserList() {
 *   const { data, fetch, loading } = useList({ namespace: "users" });
 *
 *   return (
 *     <>
 *       <button onClick={fetch} disabled={loading}>↺ Refresh</button>
 *       <ul>{data?.map(id => <li key={id}>{id}</li>)}</ul>
 *     </>
 *   );
 * }
 * ```
 *
 * @example Deferred load — fetch only when a tab is opened
 * ```tsx
 * function LazyTab({ active }: { active: boolean }) {
 *   const { data, fetch } = useList({ namespace: "users", enabled: false });
 *
 *   useEffect(() => {
 *     if (active) fetch();
 *   }, [active, fetch]);
 *
 *   return <ul>{data?.map(id => <li key={id}>{id}</li>)}</ul>;
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

      setData((prev: string[] | null) => [...(prev ?? []), ...response.ids]);
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

/**
 * Options for {@link useListHydrated}.
 */
export interface UseListHydratedOptions {
  /**
   * Namespace override for this hook.
   * Falls back to the namespace set on {@link FlexDBProvider}.
   */
  namespace?: string;
  /**
   * Number of full objects to return per page.
   * **Maximum 20** — a server constraint for hydrated responses.
   * Values above 20 are silently clamped to 20.
   * @default 20
   */
  limit?: number;
  /**
   * When `false`, the hook will **not** auto-fetch on mount.
   * Call `fetch()` manually to trigger the first page load.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Lists items and returns their **full data objects** (not just IDs).
 *
 * Identical behaviour to {@link useList} but each page item is
 * `{ id: string; data: T | null }` instead of a bare string ID.
 *
 * The server only supports full-object hydration when `limit` ≤ 20.
 * Values above 20 are **silently clamped** to 20.
 *
 * Supply the data type as a generic parameter for a fully-typed `data` field:
 * ```tsx
 * const { data } = useListHydrated<User>({ namespace: "users" });
 * // data is `{ id: string; data: User | null }[] | null`
 * ```
 *
 * For larger page sizes where you only need keys, use {@link useList} instead.
 *
 * @param options - Namespace, page size (max 20), and enabled flag. See {@link UseListHydratedOptions}.
 * @returns {@link PaginatedState} where each item is `{ id: string; data: T | null }`.
 *
 * @example Render a card grid with full item data
 * ```tsx
 * import { useListHydrated } from "@arctics/flex-db-react";
 *
 * interface User { name: string; avatarUrl: string; }
 *
 * function UserCards() {
 *   const { data, loading, hasMore, fetchMore } = useListHydrated<User>({
 *     namespace: "users",
 *     limit:     20,
 *   });
 *
 *   return (
 *     <>
 *       <div className="grid">
 *         {data?.map(({ id, data: user }) => (
 *           <UserCard key={id} id={id} user={user} />
 *         ))}
 *       </div>
 *       {loading && <Spinner />}
 *       {hasMore  && <button onClick={fetchMore}>Load more</button>}
 *     </>
 *   );
 * }
 * ```
 *
 * @example Handle null data for concurrently-deleted items
 * ```tsx
 * const { data } = useListHydrated<User>({ namespace: "users" });
 *
 * // `data` may be null for an item that was deleted between listing and hydration
 * data?.map(({ id, data: user }) =>
 *   user ? <UserCard key={id} user={user} /> : <DeletedPlaceholder key={id} />
 * );
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
      setData((prev: { id: string; data: T | null }[] | null) => [...(prev ?? []), ...response.items]);
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