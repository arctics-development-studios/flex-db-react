// ─────────────────────────────────────────────
//  FlexDB React SDK · useSearch
//  Reactive search hook with filter support and pagination.
//  Re-runs automatically when filters change.
// ─────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from "react";

import { useFlexDB }           from "../context.tsx";
import type { Filters, PaginatedState } from "../core/types.tsx";

export interface UseSearchOptions {
  /** Namespace override. Falls back to the provider-level default. */
  namespace?: string;
  /** Items per page. Max 100. @default 20 */
  limit?:     number;
  /**
   * When `false`, the hook will NOT auto-run on mount or filter change.
   * Useful when you want to gate the search on a user action.
   * Call `fetch()` manually to trigger it.
   * @default true
   */
  enabled?:   boolean;
}

/**
 * Searches indexed items and keeps your UI in sync when filters change.
 *
 * - Re-runs automatically when `filters` reference changes.
 * - Use `useMemo` (or define filters outside the component) to stabilise them
 *   and avoid unnecessary re-fetches.
 * - `fetchMore()` appends the next page to existing `data`.
 *
 * @example
 * ```tsx
 * function ProductSearch() {
 *   const [minPrice, setMinPrice] = useState(0);
 *
 *   // Stabilise filters with useMemo — prevents re-fetch on every render
 *   const filters = useMemo(() => ({
 *     price:    { gte: minPrice },
 *     category: { eq: "electronics" },
 *   }), [minPrice]);
 *
 *   const { data, loading, error, hasMore, fetchMore } = useSearch(filters, {
 *     namespace: "products",
 *     limit:     20,
 *   });
 *
 *   return (
 *     <>
 *       <input
 *         type="number"
 *         value={minPrice}
 *         onChange={e => setMinPrice(Number(e.target.value))}
 *       />
 *       <ul>
 *         {data?.map(id => <li key={id}>{id}</li>)}
 *       </ul>
 *       {loading  && <Spinner />}
 *       {hasMore  && <button onClick={fetchMore}>Load more</button>}
 *     </>
 *   );
 * }
 * ```
 */
export function useSearch(
  filters:  Filters,
  options?: UseSearchOptions,
): PaginatedState<string> {
  const client    = useFlexDB();
  const namespace = options?.namespace;
  const limit     = options?.limit;
  const enabled   = options?.enabled ?? true;

  const [data,    setData]    = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<PaginatedState<string>["error"]>(null);
  const [cursor,  setCursor]  = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  // Always read latest values in callbacks without adding to dep arrays
  const cursorRef    = useRef<string | undefined>(undefined);
  cursorRef.current  = cursor;
  const filtersRef   = useRef(filters);
  filtersRef.current = filters;
  const nsRef        = useRef(namespace);
  nsRef.current      = namespace;
  const limitRef     = useRef(limit);
  limitRef.current   = limit;

  // ── Fetch first page ───────────────────────────────────────────────────────

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await client.search({
        filters:   filtersRef.current,
        namespace: nsRef.current,
        limit:     limitRef.current,
        cursor:    undefined,
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
      const response = await client.search({
        filters:   filtersRef.current,
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

  // ── Re-run when filters change ─────────────────────────────────────────────
  // filters is intentionally in the dep array — changing filters resets page 1.
  // Consumers should stabilise with useMemo to avoid unnecessary re-fetches.
  useEffect(() => {
    if (!enabled) return;
    fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, namespace, limit, enabled, fetch]);

  return { data, loading, error, cursor, hasMore, fetch, fetchMore };
}

// ─────────────────────────────────────────────────────────────────────────────
//  useSearchHydrated
//  Same as useSearch but returns full objects. Requires limit <= 20.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseSearchHydratedOptions {
  namespace?: string;
  limit?:     number;
  enabled?:   boolean;
}

/**
 * Searches items and returns their full data (not just IDs).
 * Requires `limit` ≤ 20 (server constraint).
 *
 * @example
 * ```tsx
 * const filters = useMemo(() => ({ category: { eq: "books" } }), []);
 *
 * const { data } = useSearchHydrated<Book>(filters, {
 *   namespace: "products",
 * });
 *
 * data?.map(({ id, data: book }) => <BookCard key={id} book={book} />)
 * ```
 */
export function useSearchHydrated<T = unknown>(
  filters:  Filters,
  options?: UseSearchHydratedOptions,
): PaginatedState<{ id: string; data: T | null }> {
  const client    = useFlexDB();
  const namespace = options?.namespace;
  const limit     = Math.min(options?.limit ?? 20, 20);
  const enabled   = options?.enabled ?? true;

  const [data,    setData]    = useState<{ id: string; data: T | null }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<PaginatedState<{ id: string; data: T | null }>["error"]>(null);
  const [cursor,  setCursor]  = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  const cursorRef    = useRef<string | undefined>(undefined);
  cursorRef.current  = cursor;
  const filtersRef   = useRef(filters);
  filtersRef.current = filters;
  const nsRef        = useRef(namespace);
  nsRef.current      = namespace;

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await client.search<T>({
        filters:   filtersRef.current,
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
      const response = await client.search<T>({
        filters:   filtersRef.current,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, namespace, limit, enabled, fetch]);

  return { data, loading, error, cursor, hasMore, fetch, fetchMore };
}