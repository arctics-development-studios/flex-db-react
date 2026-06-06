/**
 * React hooks for paginated listing of FlexDB items.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useList / useListHydrated
//  Paginated list hooks with "load more" / infinite scroll.
//  data accumulates across pages — never resets on fetchMore.
//  In-flight requests are cancelled on unmount and on new fetch.
//  Delegates to FlexDBClient.list() from @arctics/flex-db-sdk.
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
   * Number of item keys to return per page. Max 1000.
   * @default 50
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
 * Lists item **keys** in the namespace with built-in cursor pagination.
 *
 * - **Auto-fetches** the first page on mount (unless `enabled: false`).
 * - `fetch()` resets to page 1 and **replaces** `data`.
 * - `fetchMore()` fetches the next page and **appends** to `data`.
 * - `hasMore` is `true` when more pages are available server-side.
 * - **Cancels** the in-flight request when the component unmounts.
 *
 * When you need full item objects instead of just keys, use
 * {@link useListHydrated} (limit must be ≤ 50).
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
 *       <ul>{data?.map(id => <li key={id}>{id}</li>)}</ul>
 *       {loading  && <Spinner />}
 *       {error    && <p className="error">{error.message}</p>}
 *       {hasMore  && <button onClick={fetchMore} disabled={loading}>Load more</button>}
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

  const cursorRef    = useRef<string | undefined>(undefined);
  cursorRef.current  = cursor;
  const nsRef        = useRef(namespace);
  nsRef.current      = namespace;
  const limitRef     = useRef(limit);
  limitRef.current   = limit;
  const abortRef     = useRef<AbortController | null>(null);

  const fetch = useCallback(async () => {
    abortRef.current?.abort();
    const controller  = new AbortController();
    abortRef.current  = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await client.list({
        namespace: nsRef.current,
        limit:     limitRef.current,
        cursor:    undefined,
        hydrate:   false,
        signal:    controller.signal,
      });

      setData(result.keys);
      setCursor(result.cursor ?? undefined);
      setHasMore(result.cursor !== null);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err as Error);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [client]);

  const fetchMore = useCallback(async () => {
    if (!cursorRef.current) return;

    abortRef.current?.abort();
    const controller  = new AbortController();
    abortRef.current  = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await client.list({
        namespace: nsRef.current,
        limit:     limitRef.current,
        cursor:    cursorRef.current,
        hydrate:   false,
        signal:    controller.signal,
      });

      setData((prev: string[] | null) => [...(prev ?? []), ...result.keys]);
      setCursor(result.cursor ?? undefined);
      setHasMore(result.cursor !== null);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err as Error);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (!enabled) return;
    fetch();
    return () => { abortRef.current?.abort(); };
  }, [namespace, limit, enabled, fetch]);

  return { data, loading, error, cursor, hasMore, fetch, fetchMore };
}

// ─────────────────────────────────────────────────────────────────────────────
//  useListHydrated
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
   * **Maximum 50** — server constraint for hydrated responses.
   * Values above 50 are silently clamped to 50.
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
 * Lists items and returns their **full data objects** (not just keys).
 *
 * Identical behaviour to {@link useList} but each page item is
 * `{ key: string; data: T }` instead of a bare string key.
 *
 * The server only supports full-object hydration when `limit` ≤ 50.
 * Values above 50 are **silently clamped** to 50.
 *
 * Supply the data type as a generic parameter for a fully-typed `data` field:
 * ```tsx
 * const { data } = useListHydrated<User>({ namespace: "users" });
 * // data is `{ key: string; data: User }[] | null`
 * ```
 *
 * @param options - Namespace, page size (max 50), and enabled flag.
 * @returns {@link PaginatedState} where each item is `{ key: string; data: T }`.
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
 *         {data?.map(({ key, data: user }) => (
 *           <UserCard key={key} user={user} />
 *         ))}
 *       </div>
 *       {loading && <Spinner />}
 *       {hasMore  && <button onClick={fetchMore}>Load more</button>}
 *     </>
 *   );
 * }
 * ```
 */
export function useListHydrated<T = unknown>(
  options?: UseListHydratedOptions,
): PaginatedState<{ key: string; data: T }> {
  const client    = useFlexDB();
  const namespace = options?.namespace;
  const limit     = Math.min(options?.limit ?? 20, 50);
  const enabled   = options?.enabled ?? true;

  const [data,    setData]    = useState<{ key: string; data: T }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<PaginatedState<{ key: string; data: T }>["error"]>(null);
  const [cursor,  setCursor]  = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  const cursorRef   = useRef<string | undefined>(undefined);
  cursorRef.current = cursor;
  const nsRef       = useRef(namespace);
  nsRef.current     = namespace;
  const abortRef    = useRef<AbortController | null>(null);

  const fetch = useCallback(async () => {
    abortRef.current?.abort();
    const controller  = new AbortController();
    abortRef.current  = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await client.list<T>({
        namespace: nsRef.current,
        limit,
        cursor:    undefined,
        hydrate:   true,
        signal:    controller.signal,
      });
      // Base SDK returns `items` (not `keys`) for hydrated responses
      setData(result.items);
      setCursor(result.cursor ?? undefined);
      setHasMore(result.cursor !== null);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err as Error);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [client, limit]);

  const fetchMore = useCallback(async () => {
    if (!cursorRef.current) return;

    abortRef.current?.abort();
    const controller  = new AbortController();
    abortRef.current  = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await client.list<T>({
        namespace: nsRef.current,
        limit,
        cursor:    cursorRef.current,
        hydrate:   true,
        signal:    controller.signal,
      });
      // Base SDK returns `items` (not `keys`) for hydrated responses
      setData((prev) => [...(prev ?? []), ...result.items]);
      setCursor(result.cursor ?? undefined);
      setHasMore(result.cursor !== null);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err as Error);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [client, limit]);

  useEffect(() => {
    if (!enabled) return;
    fetch();
    return () => { abortRef.current?.abort(); };
  }, [namespace, limit, enabled, fetch]);

  return { data, loading, error, cursor, hasMore, fetch, fetchMore };
}
