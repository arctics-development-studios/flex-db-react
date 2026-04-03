/**
 * React hooks for reactive, paginated search over indexed FlexDB items.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useSearch / useSearchHydrated
//  Reactive search hooks with filter support and pagination.
//  Re-runs automatically when filters change.
// ─────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from "react";

import { useFlexDB }           from "../context.tsx";
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
   * Number of item keys to return per page.
   * Max 100.
   * @default 20
   */
  limit?: number;
  /**
   * When `false`, the hook will **not** auto-run on mount or when `filters`
   * changes. Call `fetch()` manually to trigger the first search.
   *
   * Useful when you want to gate the search on a button press rather than
   * running it on every keystroke.
   *
   * @default true
   */
  enabled?: boolean;
}

/**
 * Searches indexed items and keeps your UI in sync whenever filters change.
 *
 * - **Reactive** — re-runs automatically when the `filters` reference changes.
 * - **Paginated** — `fetchMore()` appends the next page to `data`.
 * - **Stable** — `data` accumulates across `fetchMore` calls without resetting.
 *
 * ### Stabilising filters
 *
 * The hook watches the `filters` argument using reference equality.
 * A new object on every render will trigger a new search on every render.
 * Always stabilise the filter object with `useMemo`:
 *
 * ```tsx
 * // ✅ Stable — only re-runs when minPrice changes
 * const filters = useMemo(() => ({ price: { gte: minPrice } }), [minPrice]);
 *
 * // ❌ Unstable — new object on every render = search on every render
 * const filters = { price: { gte: minPrice } };
 * ```
 *
 * Items must have been written with `searchParams` for the queried fields to
 * be available. See {@link useCreate} and {@link useSet}.
 *
 * When you need full item objects instead of just IDs, use
 * {@link useSearchHydrated} (limit must be ≤ 20).
 *
 * @param filters - Filter predicates evaluated server-side. See {@link Filters}.
 * @param options - Namespace, page size, and enabled flag. See {@link UseSearchOptions}.
 * @returns {@link PaginatedState} with `data`, `loading`, `error`, `hasMore`, `fetch`, and `fetchMore`.
 *
 * @example Reactive product search with a price filter
 * ```tsx
 * import { useSearch } from "@arctics/flex-db-react";
 *
 * function ProductSearch() {
 *   const [minPrice, setMinPrice] = useState(0);
 *
 *   // Stabilise with useMemo — prevents re-fetch on every render
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
 *         placeholder="Min price"
 *       />
 *       {error && <p className="error">{error.message}</p>}
 *       <ul>
 *         {data?.map(id => <li key={id}>{id}</li>)}
 *       </ul>
 *       {loading && <Spinner />}
 *       {hasMore  && <button onClick={fetchMore}>Load more</button>}
 *     </>
 *   );
 * }
 * ```
 *
 * @example Search triggered by a button press (`enabled: false`)
 * ```tsx
 * function SearchOnDemand() {
 *   const [query, setQuery] = useState("");
 *   const filters = useMemo(() => ({ name: { sw: query } }), [query]);
 *
 *   const { data, fetch, loading } = useSearch(filters, {
 *     namespace: "users",
 *     enabled:   false, // don't auto-search — wait for the button
 *   });
 *
 *   return (
 *     <>
 *       <input value={query} onChange={e => setQuery(e.target.value)} />
 *       <button onClick={fetch} disabled={loading}>Search</button>
 *       <ul>{data?.map(id => <li key={id}>{id}</li>)}</ul>
 *     </>
 *   );
 * }
 * ```
 *
 * @example Combining multiple filters
 * ```tsx
 * const filters = useMemo(() => ({
 *   price:    { gte: 10, lte: 100 },    // range
 *   category: { eq: "books" },          // exact match
 *   inStock:  { eq: true },             // boolean
 *   tags:     { inc: "sale" },          // array contains
 *   sku:      { sw: "BOOK-" },          // starts with
 * }), []);
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
   * **Maximum 20** — a server constraint for hydrated responses.
   * Values above 20 are silently clamped to 20.
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
 * Searches items and returns their **full data objects** (not just IDs).
 *
 * Identical behaviour to {@link useSearch} but each page item is
 * `{ id: string; data: T | null }` instead of a bare string ID.
 *
 * The server only supports full-object hydration when `limit` ≤ 20.
 * Values above 20 are **silently clamped** to 20.
 *
 * Like {@link useSearch}, the `filters` argument is watched by reference —
 * always stabilise it with `useMemo` to avoid unnecessary re-fetches.
 *
 * Supply the data type as a generic parameter for a fully-typed `data` field:
 * ```tsx
 * const { data } = useSearchHydrated<Product>(filters);
 * // data is `{ id: string; data: Product | null }[] | null`
 * ```
 *
 * @param filters - Filter predicates evaluated server-side. See {@link Filters}.
 * @param options - Namespace, page size (max 20), and enabled flag. See {@link UseSearchHydratedOptions}.
 * @returns {@link PaginatedState} where each item is `{ id: string; data: T | null }`.
 *
 * @example Render search results as cards with full data
 * ```tsx
 * import { useSearchHydrated } from "@arctics/flex-db-react";
 *
 * interface Product { title: string; price: number; imageUrl: string; }
 *
 * function ProductGrid() {
 *   const [category, setCategory] = useState("all");
 *
 *   const filters = useMemo(() => (
 *     category === "all" ? {} : { category: { eq: category } }
 *   ), [category]);
 *
 *   const { data, loading, hasMore, fetchMore } = useSearchHydrated<Product>(filters, {
 *     namespace: "products",
 *     limit:     12,
 *   });
 *
 *   return (
 *     <>
 *       <select value={category} onChange={e => setCategory(e.target.value)}>
 *         <option value="all">All</option>
 *         <option value="electronics">Electronics</option>
 *         <option value="books">Books</option>
 *       </select>
 *       <div className="grid">
 *         {data?.map(({ id, data: product }) =>
 *           product
 *             ? <ProductCard key={id} product={product} />
 *             : <DeletedPlaceholder key={id} />
 *         )}
 *       </div>
 *       {loading && <Spinner />}
 *       {hasMore  && <button onClick={fetchMore}>Load more</button>}
 *     </>
 *   );
 * }
 * ```
 *
 * @example Empty-state handling
 * ```tsx
 * const { data, loading } = useSearchHydrated<User>(filters, { namespace: "users" });
 *
 * if (loading)          return <Spinner />;
 * if (!data?.length)    return <p>No results found.</p>;
 *
 * return data.map(({ id, data: user }) => <UserCard key={id} user={user} />);
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