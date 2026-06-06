/**
 * React hooks for reactive, paginated search over indexed FlexDB items.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useSearch / useSearchHydrated
//  Reactive search hooks with filter support and pagination.
//  Re-runs automatically when filters change.
//  In-flight requests are cancelled on unmount and on new fetch.
//  Delegates to FlexDBClient.search() from @arctics/flex-db-sdk.
// ─────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from "react";

import { useFlexDB }                   from "../context.tsx";
import type { Filters, PaginatedState } from "../core/types.tsx";

/**
 * Options for {@link useSearch}.
 */
export interface UseSearchOptions {
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
   * When `false`, the hook will **not** auto-run on mount or when `filters`
   * changes. Call `fetch()` manually to trigger the first search.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Searches indexed items and keeps your UI in sync whenever filters change.
 *
 * - **Reactive** — re-runs automatically when the `filters` reference changes.
 * - **Paginated** — `fetchMore()` appends the next page to `data`.
 * - **Cancels** in-flight requests on unmount and when superseded by a new fetch.
 *
 * ### Stabilising filters
 *
 * The hook watches the `filters` argument by reference equality.
 * Always stabilise the filter object with `useMemo`:
 *
 * ```tsx
 * // ✅ Only re-runs when minPrice changes
 * const filters = useMemo(() => ({ price: { gte: minPrice } }), [minPrice]);
 *
 * // ❌ New object on every render = search on every render
 * const filters = { price: { gte: minPrice } };
 * ```
 *
 * Items must have been written with `sp` for the queried fields to be available.
 * See {@link useCreate} and {@link useSet}.
 *
 * @param filters - Filter predicates evaluated server-side. See {@link Filters}.
 * @param options - Namespace, page size, and enabled flag.
 * @returns {@link PaginatedState} with `data`, `loading`, `error`, `hasMore`, `fetch`, and `fetchMore`.
 *
 * @example Reactive product search with price filter
 * ```tsx
 * import { useSearch } from "@arctics/flex-db-react";
 *
 * function ProductSearch() {
 *   const [minPrice, setMinPrice] = useState(0);
 *
 *   const filters = useMemo(() => ({
 *     price:    { gte: minPrice },
 *     category: { eq: "electronics" },
 *   }), [minPrice]);
 *
 *   const { data, loading, hasMore, fetchMore } = useSearch(filters, {
 *     namespace: "products",
 *     limit:     20,
 *   });
 *
 *   return (
 *     <>
 *       <input type="number" value={minPrice} onChange={e => setMinPrice(+e.target.value)} />
 *       <ul>{data?.map(id => <li key={id}>{id}</li>)}</ul>
 *       {loading && <Spinner />}
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

  const cursorRef    = useRef<string | undefined>(undefined);
  cursorRef.current  = cursor;
  const filtersRef   = useRef(filters);
  filtersRef.current = filters;
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
      const result = await client.search({
        filters:   filtersRef.current,
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
      const result = await client.search({
        filters:   filtersRef.current,
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

  // filters is intentionally in the dep array — changing filters resets to page 1
  useEffect(() => {
    if (!enabled) return;
    fetch();
    return () => { abortRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, namespace, limit, enabled, fetch]);

  return { data, loading, error, cursor, hasMore, fetch, fetchMore };
}

// ─────────────────────────────────────────────────────────────────────────────
//  useSearchHydrated
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for {@link useSearchHydrated}.
 */
export interface UseSearchHydratedOptions {
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
   * When `false`, the hook will **not** auto-run on mount or when `filters`
   * changes. Call `fetch()` manually to trigger the first search.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Searches items and returns their **full data objects** (not just keys).
 *
 * Identical behaviour to {@link useSearch} but each page item is
 * `{ key: string; data: T }` instead of a bare string key.
 *
 * The server only supports full-object hydration when `limit` ≤ 50.
 * Values above 50 are **silently clamped** to 50.
 *
 * Like {@link useSearch}, always stabilise `filters` with `useMemo`.
 *
 * @param filters - Filter predicates evaluated server-side. See {@link Filters}.
 * @param options - Namespace, page size (max 50), and enabled flag.
 * @returns {@link PaginatedState} where each item is `{ key: string; data: T }`.
 *
 * @example Render search results as cards with full data
 * ```tsx
 * import { useSearchHydrated } from "@arctics/flex-db-react";
 *
 * interface Product { title: string; price: number; }
 *
 * function ProductGrid() {
 *   const filters = useMemo(() => ({ category: { eq: "books" } }), []);
 *
 *   const { data, hasMore, fetchMore } = useSearchHydrated<Product>(filters, {
 *     namespace: "products",
 *     limit:     12,
 *   });
 *
 *   return (
 *     <>
 *       {data?.map(({ key, data: product }) => (
 *         <ProductCard key={key} product={product} />
 *       ))}
 *       {hasMore && <button onClick={fetchMore}>Load more</button>}
 *     </>
 *   );
 * }
 * ```
 */
export function useSearchHydrated<T = unknown>(
  filters:  Filters,
  options?: UseSearchHydratedOptions,
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

  const cursorRef    = useRef<string | undefined>(undefined);
  cursorRef.current  = cursor;
  const filtersRef   = useRef(filters);
  filtersRef.current = filters;
  const nsRef        = useRef(namespace);
  nsRef.current      = namespace;
  const abortRef     = useRef<AbortController | null>(null);

  const fetch = useCallback(async () => {
    abortRef.current?.abort();
    const controller  = new AbortController();
    abortRef.current  = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await client.search<T>({
        filters:   filtersRef.current,
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
      const result = await client.search<T>({
        filters:   filtersRef.current,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, namespace, limit, enabled, fetch]);

  return { data, loading, error, cursor, hasMore, fetch, fetchMore };
}
