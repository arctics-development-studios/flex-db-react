/**
 * TypeScript contracts for the FlexDB React SDK.
 *
 * All base types (client options, search params, filters, errors, operation
 * results) are re-exported directly from `@arctics/flex-db-sdk` so there is
 * one authoritative source of truth. This file adds only the React-specific
 * state interfaces that have no equivalent in the base SDK.
 *
 * You rarely need to import from here directly — use `@arctics/flex-db-react`
 * instead.
 *
 * @module
 */

// ── Re-exports from base SDK ───────────────────────────────────────────────

export type {
  // Config
  RetryConfig,
  FlexDBClientOptions,

  // Operation options
  OperationOptions,
  CreateOptions,
  SetOptions,
  GetOptions,
  DeleteOptions,
  ListOptions,
  SearchOptions,

  // Data shapes
  SearchParams,
  Filters,
  FilterOperators,

  // Bulk items
  BulkCreateItem,
  BulkSetItem,

  // Results
  HealthResult,
  CreateResult,
  SetResult,
  GetResult,
  DeleteResult,
  ListIdsResult,
  ListItemsResult,
  BulkGetItem,
  BulkGetResult,
  BulkCreateResultItem,
  BulkCreateResult,
  BulkSetResultItem,
  BulkSetResult,
  BulkDeleteResult,
} from "@arctics/flex-db-sdk";

export { FlexDBError, FlexDBNetworkError } from "@arctics/flex-db-sdk";

/**
 * Configuration object passed to {@link FlexDBProvider}.
 * Alias for {@link FlexDBClientOptions} from the base SDK.
 *
 * Define this object **outside** your component (or with `useMemo`) so its
 * reference stays stable across renders. An unstable reference causes the
 * provider to re-create its internal client on every render.
 *
 * @example
 * ```tsx
 * const config: FlexDBConfig = {
 *   apiKey:    import.meta.env.VITE_FLEXDB_KEY,
 *   baseUrl:   "https://eu.flex.arctics.dev",
 *   namespace: "users",
 *   retry:     { times: 3, delay: 10 },
 * };
 *
 * <FlexDBProvider config={config}><App /></FlexDBProvider>
 * ```
 */
export type { FlexDBClientOptions as FlexDBConfig } from "@arctics/flex-db-sdk";

// ── React hook state shapes ────────────────────────────────────────────────

/**
 * Base state shape shared by every FlexDB hook.
 *
 * - `data` starts as `null` and is populated on the first successful operation.
 *   It **persists** across subsequent fetches so the UI never flashes to empty
 *   while a background refresh is in progress.
 * - `loading` is `true` only while a request is in-flight.
 * - `error` holds the most recent failure, or `null` if the last call succeeded.
 */
export interface HookState<T> {
  /** The result of the last successful operation, or `null` if never run. */
  data:    T | null;
  /** `true` while a request is currently in-flight. */
  loading: boolean;
  /** The last error, or `null` if the most recent call succeeded. */
  error:   import("@arctics/flex-db-sdk").FlexDBError | import("@arctics/flex-db-sdk").FlexDBNetworkError | Error | null;
}

/**
 * State returned by {@link useGet}.
 *
 * Extends {@link HookState} with a `refetch` function for manual re-fetching.
 *
 * @example
 * ```tsx
 * const { data, loading, error, refetch }: UseGetState<User> = useGet(userId);
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

/**
 * State returned by mutation hooks: {@link useCreate}, {@link useSet},
 * {@link useDelete}, {@link useBulkCreate}, {@link useBulkSet},
 * {@link useBulkDelete}.
 *
 * `execute` is memoised with `useCallback` and stays stable across renders,
 * so it is safe to pass as a prop or use as an effect dependency.
 *
 * `reset` clears `data` and `error`, returning the hook to its initial state.
 *
 * @example
 * ```tsx
 * const { execute, loading, data, error, reset }: UseMutationState<CreateArgs, CreateResult>
 *   = useCreate({ namespace: "users" });
 * ```
 */
export interface UseMutationState<TArgs, TResult> extends HookState<TResult> {
  /**
   * Triggers the mutation with `args`.
   * Returns the result directly and also updates `data` state.
   * On failure, sets `error` state **and** re-throws.
   */
  execute: (args: TArgs) => Promise<TResult>;
  /**
   * Clears `data`, `error`, and `loading`, returning the hook to its initial
   * idle state. Does not cancel in-flight requests.
   */
  reset:   () => void;
}

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
 * @example
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
   * Opaque cursor token from the last page fetch.
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
