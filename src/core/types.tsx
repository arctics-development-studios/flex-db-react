/**
 * All TypeScript contracts for the FlexDB React SDK.
 *
 * This module is re-exported from the root entry-point — you rarely need
 * to import from here directly. Use `@arctics/flex-db-react` instead.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · Types
//  All contracts: core API types + React state shapes.
//  Zero dependencies — no React import needed here.
// ─────────────────────────────────────────────

// ── Retry ──────────────────────────────────────────────────────────────────

/**
 * Controls how the SDK re-attempts failed requests.
 *
 * Only transient errors are retried:
 *
 * | Scenario                | Retried? |
 * |-------------------------|----------|
 * | Network failure         | ✅        |
 * | HTTP 429 (rate limit)   | ✅        |
 * | HTTP 5xx (server error) | ✅        |
 * | HTTP 4xx (client error) | ❌        |
 * | Component unmounted     | ❌        |
 *
 * Pass this as the `retry` field in {@link FlexDBConfig}.
 *
 * @example
 * ```tsx
 * <FlexDBProvider config={{ ..., retry: { times: 5, delay: 50 } }}>
 * ```
 *
 * @example Disable retries entirely
 * ```tsx
 * <FlexDBProvider config={{ ..., retry: false }}>
 * ```
 */
export interface RetryConfig {
  /**
   * Maximum retry attempts **after** the first failure.
   * `0` = no retries. Values are clamped to the range `[0, 10]`.
   * @default 3
   */
  times: number;
  /**
   * Fixed delay in milliseconds between each retry attempt.
   * @default 10
   */
  delay: number;
}

// ── Client config ──────────────────────────────────────────────────────────

/**
 * Configuration object passed to {@link FlexDBProvider}.
 *
 * Define this object **outside** your component (or with `useMemo`) so its
 * reference stays stable across renders. An unstable reference causes the
 * provider to re-create its internal client on every render.
 *
 * @example Minimal configuration
 * ```tsx
 * const config = {
 *   apiKey:  import.meta.env.VITE_FLEXDB_KEY,
 *   baseUrl: "https://eu.flex.arctics.dev",
 * };
 *
 * <FlexDBProvider config={config}>
 *   <App />
 * </FlexDBProvider>
 * ```
 *
 * @example Full configuration
 * ```tsx
 * const config: FlexDBConfig = {
 *   apiKey:    import.meta.env.VITE_FLEXDB_KEY,
 *   baseUrl:   "https://eu.flex.arctics.dev",
 *   namespace: "users",
 *   retry:     { times: 5, delay: 50 },
 * };
 * ```
 */
export interface FlexDBConfig {
  /**
   * Your JWT API key.
   * Sent as `Authorization: Bearer <apiKey>` on every request.
   * Keep this secret — use environment variables, never commit it directly.
   */
  apiKey: string;
  /**
   * Base URL of your FlexDB service instance.
   * Trailing slashes are stripped automatically.
   * @example "https://eu.flex.arctics.dev"
   */
  baseUrl: string;
  /**
   * Default namespace (collection) applied to every hook in the tree.
   * Can be overridden per-hook via the `namespace` option on any hook.
   *
   * @example
   * ```tsx
   * // Provider default
   * <FlexDBProvider config={{ ..., namespace: "users" }}>
   *
   * // Override in a specific hook
   * const { data } = useGet(id, { namespace: "admins" });
   * ```
   */
  namespace?: string;
  /**
   * Retry behaviour for transient request failures.
   * Pass `false` to disable retries entirely.
   * See {@link RetryConfig} for available options.
   * @default \{ times: 3, delay: 10 \}
   */
  retry?: RetryConfig | false;
}

// ── Search params / filters ────────────────────────────────────────────────

/**
 * A single JSON-serialisable value accepted in {@link SearchParams}.
 * Arrays are supported for multi-value indexed fields.
 *
 * @example
 * ```ts
 * const searchParams: SearchParams = {
 *   price:   49.99,        // number
 *   inStock: true,         // boolean
 *   tags:    ["sale","new"], // array
 *   label:   null,         // null clears a previously-set value
 * };
 * ```
 */
export type SearchParamValue =
  | string
  | number
  | boolean
  | null
  | (string | number | boolean | null)[];

/**
 * Key-value map of fields to index at write-time.
 *
 * Pass as `searchParams` inside {@link CreateArgs} or {@link SetArgs} to make
 * an item queryable via {@link useSearch} / {@link useSearchHydrated}.
 * Values must be JSON-serialisable (see {@link SearchParamValue}).
 *
 * @example
 * ```tsx
 * const { execute } = useCreate({ namespace: "products" });
 *
 * await execute({
 *   value:        { title: "Widget Pro", price: 49.99 },
 *   searchParams: { price: 49.99, category: "electronics", inStock: true },
 * });
 * ```
 */
export type SearchParams = Record<string, SearchParamValue>;

/**
 * Comparison and membership operators used in {@link Filters}.
 *
 * Combine multiple operators on a single field to express range queries:
 *
 * ```ts
 * // Price between 10 and 100 (inclusive)
 * price: { gte: 10, lte: 100 }
 * ```
 *
 * @example All operators
 * ```ts
 * const filters: Filters = {
 *   price:    { gte: 10, lte: 100 },   // numeric range
 *   category: { eq: "electronics" },   // exact match
 *   sku:      { sw: "WIDGET-" },        // starts with
 *   tags:     { inc: "sale" },          // array / string contains
 *   rating:   { neq: null },            // not null
 *   discount: { ex: true },             // field exists
 * };
 * ```
 */
export interface FilterOperators {
  /** Exact match — equivalent to `field === value`. */
  eq?:  SearchParamValue;
  /** Not equal — equivalent to `field !== value`. */
  neq?: SearchParamValue;
  /** Greater than — equivalent to `field > value`. */
  gt?:  SearchParamValue;
  /** Greater than or equal — equivalent to `field >= value`. */
  gte?: SearchParamValue;
  /** Less than — equivalent to `field < value`. */
  lt?:  SearchParamValue;
  /** Less than or equal — equivalent to `field <= value`. */
  lte?: SearchParamValue;
  /** String contains (substring check) or array includes the given value. */
  inc?: SearchParamValue;
  /** String starts with the given prefix. */
  sw?:  SearchParamValue;
  /**
   * Attribute existence check.
   * `true` → field must exist; `false` → field must not exist.
   */
  ex?:  boolean;
}

/**
 * Filter map passed to {@link useSearch} and {@link useSearchHydrated}.
 *
 * Each key corresponds to a field you indexed with `searchParams` at write-time.
 * The value is a {@link FilterOperators} object describing the predicate.
 *
 * **Important:** stabilise the `filters` object with `useMemo` (or define it
 * outside the component). A new object reference on every render will trigger
 * a new search request on every render.
 *
 * @example
 * ```tsx
 * const filters = useMemo<Filters>(() => ({
 *   price:    { gte: minPrice, lte: maxPrice },
 *   category: { eq: selectedCategory },
 *   inStock:  { eq: true },
 * }), [minPrice, maxPrice, selectedCategory]);
 *
 * const { data } = useSearch(filters, { namespace: "products" });
 * ```
 */
export type Filters = Record<string, FilterOperators>;

// ── API response shapes (raw JSON from the server) ─────────────────────────

/**
 * Returned by {@link useCreate} as `data` after a successful `execute()` call.
 *
 * @example
 * ```tsx
 * const { execute, data } = useCreate();
 * await execute({ value: { name: "Alice" } });
 * console.log(data?.key); // server-generated NanoID
 * ```
 */
export interface CreateResponse {
  success: true;
  /**
   * Server-generated NanoID key for the newly created item.
   * Store this — it is the only way to retrieve or delete the item later.
   */
  key: string;
}

/**
 * Returned by {@link useSet} as `data` after a successful `execute()` call.
 *
 * @example
 * ```tsx
 * const { execute, data } = useSet();
 * await execute({ key: "user-42", value: { name: "Bob" } });
 * console.log(data?.key); // "user-42"
 * ```
 */
export interface SetResponse {
  success: true;
  /** The caller-supplied key used to store the item. */
  key: string;
}

/**
 * Raw server response shape for a single-item fetch.
 * Surfaced as `data` in the {@link UseGetState} returned by {@link useGet}.
 *
 * Note: `useGet` unwraps `.item` automatically — your component receives
 * `data` typed as `T`, not `GetResponse<T>`.
 */
export interface GetResponse<T = unknown> {
  success: true;
  /** The stored item, deserialised as type `T`. */
  item: T;
}

/**
 * Returned by {@link useDelete} as `data` after a successful `execute()` call.
 *
 * @example
 * ```tsx
 * const { execute, data } = useDelete();
 * await execute({ key: "user-42" });
 * console.log(data?.success); // true
 * ```
 */
export interface DeleteResponse {
  success: true;
}

/**
 * Raw server response for list/search operations that return only item IDs.
 * Surfaced as `data` (array of strings) and `cursor`/`hasMore` in
 * {@link PaginatedState} returned by {@link useList} and {@link useSearch}.
 */
export interface ListIdsResponse {
  /** Array of item keys on this page. */
  ids: string[];
  /**
   * Pass as `cursor` on the next call to fetch the next page.
   * `undefined` means this is the last page.
   */
  nextCursor?: string;
}

/**
 * Raw server response for list/search operations that return full item objects.
 * Surfaced as `data` (array of `{ id, data }`) in {@link PaginatedState}
 * returned by {@link useListHydrated} and {@link useSearchHydrated}.
 */
export interface ListItemsResponse<T = unknown> {
  /** Array of `{ id, data }` pairs. `data` may be `null` if an item was concurrently deleted. */
  items: { id: string; data: T | null }[];
  /**
   * Pass as `cursor` on the next call to fetch the next page.
   * `undefined` means this is the last page.
   */
  nextCursor?: string;
}

// ── Errors ─────────────────────────────────────────────────────────────────

/**
 * Thrown (and surfaced as `error`) when the FlexDB server returns a non-2xx
 * HTTP response.
 *
 * Inspect {@link FlexDBError.status} for the HTTP status code and
 * {@link FlexDBError.body} for the raw error payload from the server.
 *
 * @example Narrow the error type in a component
 * ```tsx
 * import { FlexDBError } from "@arctics/flex-db-react";
 *
 * const { error } = useGet("some-key");
 *
 * if (error instanceof FlexDBError) {
 *   if (error.status === 404) return <p>Not found</p>;
 *   if (error.status === 401) return <p>Unauthorised</p>;
 *   return <p>Server error {error.status}</p>;
 * }
 * ```
 */
export class FlexDBError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name   = "FlexDBError";
    this.status = status;
    this.body   = body;
  }
}

/**
 * Thrown (and surfaced as `error`) when the HTTP request itself fails before
 * a response is received — for example, due to a DNS failure, connection
 * refused, or a network timeout.
 *
 * The original error from `fetch` is available as {@link FlexDBNetworkError.cause}.
 *
 * @example
 * ```tsx
 * import { FlexDBNetworkError } from "@arctics/flex-db-react";
 *
 * const { error } = useGet("some-key");
 *
 * if (error instanceof FlexDBNetworkError) {
 *   console.error("Network error:", error.message);
 *   console.error("Caused by:", error.cause);
 * }
 * ```
 */
export class FlexDBNetworkError extends Error {
  override readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name  = "FlexDBNetworkError";
    this.cause = cause;
  }
}

// ── React hook state shapes ────────────────────────────────────────────────

/**
 * Base state shape shared by every FlexDB hook.
 *
 * - `data` starts as `null` and is populated on the first successful operation.
 *   It **persists** across subsequent fetches so the UI never flashes to empty
 *   while a background refresh is in progress.
 * - `loading` is `true` only while a request is in-flight.
 * - `error` holds the most recent failure, or `null` if the last call succeeded.
 *
 * All three fields reset correctly across re-fetches and re-mounts.
 */
export interface HookState<T> {
  /** The result of the last successful operation, or `null` if never run. */
  data:    T | null;
  /** `true` while a request is currently in-flight. */
  loading: boolean;
  /** The last error, or `null` if the most recent call succeeded. */
  error:   FlexDBError | FlexDBNetworkError | Error | null;
}

// ── useGet state ───────────────────────────────────────────────────────────

/**
 * State returned by {@link useGet}.
 *
 * Extends {@link HookState} with a `refetch` function for manual re-fetching.
 *
 * @example
 * ```tsx
 * const { data, loading, error, refetch }: UseGetState<User> = useGet(userId);
 *
 * // Manual refresh on button click
 * <button onClick={refetch}>Refresh</button>
 * ```
 */
export interface UseGetState<T> extends HookState<T> {
  /**
   * Manually triggers a fresh fetch for the current `key`.
   * Cancels any in-flight request before starting the new one.
   */
  refetch: () => void;
}

// ── useMutation state ──────────────────────────────────────────────────────

/**
 * State returned by {@link useCreate}, {@link useSet}, and {@link useDelete}.
 *
 * `execute` is memoised with `useCallback` and stays stable across renders,
 * so it is safe to pass as a prop or use as an effect dependency.
 *
 * `reset` clears `data` and `error`, returning the hook to its initial state —
 * useful when navigating away or closing a form.
 *
 * @example
 * ```tsx
 * const { execute, loading, data, error, reset }: UseMutationState<CreateArgs, CreateResponse>
 *   = useCreate({ namespace: "users" });
 *
 * // After a successful creation, reset to allow creating another
 * const handleSuccess = () => {
 *   console.log("Key:", data?.key);
 *   reset();
 * };
 * ```
 */
export interface UseMutationState<TArgs, TResult> extends HookState<TResult> {
  /**
   * Triggers the mutation with `args`.
   * Returns the result directly and also updates `data` state.
   * On failure, sets `error` state **and** re-throws — wrap in try/catch
   * if you need to react to failures inline.
   */
  execute: (args: TArgs) => Promise<TResult>;
  /**
   * Clears `data`, `error`, and `loading`, returning the hook to its
   * initial idle state. Does not cancel in-flight requests.
   */
  reset:   () => void;
}

// ── useList / useSearch state ──────────────────────────────────────────────

/**
 * State returned by {@link useList}, {@link useListHydrated},
 * {@link useSearch}, and {@link useSearchHydrated}.
 *
 * Implements a "load more" / infinite-scroll pattern:
 * - `data` accumulates items across pages — it never resets on `fetchMore`.
 * - Call `fetch()` to reset to the first page (e.g. when filters change).
 * - Call `fetchMore()` to append the next page.
 * - `hasMore` tells you whether there is another page available.
 *
 * @example Basic infinite scroll
 * ```tsx
 * const { data, loading, hasMore, fetchMore }: PaginatedState<string> = useList();
 *
 * return (
 *   <>
 *     <ul>{data?.map(id => <li key={id}>{id}</li>)}</ul>
 *     {loading  && <Spinner />}
 *     {hasMore  && <button onClick={fetchMore}>Load more</button>}
 *   </>
 * );
 * ```
 */
export interface PaginatedState<T> extends HookState<T[]> {
  /**
   * Opaque cursor token returned by the last page fetch.
   * `undefined` before the first fetch or when on the last page.
   * You rarely need this directly — `fetchMore` manages it internally.
   */
  cursor:    string | undefined;
  /** `true` when the server has more pages available beyond the current `data`. */
  hasMore:   boolean;
  /**
   * Fetches the first page and **replaces** `data`.
   * Called automatically on mount (unless `enabled: false`).
   * Call manually to reset after a filter or namespace change.
   */
  fetch:     () => void;
  /**
   * Fetches the next page and **appends** its items to `data`.
   * No-op when `hasMore` is `false` or `cursor` is not set.
   */
  fetchMore: () => void;
}