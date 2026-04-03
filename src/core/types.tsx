// ─────────────────────────────────────────────
//  FlexDB React SDK · Types
//  All contracts: core API types + React state shapes.
//  Zero dependencies — no React import needed here.
// ─────────────────────────────────────────────

// ── Retry ──────────────────────────────────────────────────────────────────

/** Controls how the SDK re-attempts failed requests. */
export interface RetryConfig {
  /**
   * Maximum retry attempts after the first failure. 0 = no retries. Max = 10.
   * @default 3
   */
  times: number;
  /**
   * Milliseconds to wait between each retry.
   * @default 10
   */
  delay: number;
}

// ── Client config ──────────────────────────────────────────────────────────

/** Passed to `FlexDBProvider` or `createClient()`. */
export interface FlexDBConfig {
  /** Your JWT API key — sent as `Authorization: Bearer <apiKey>`. */
  apiKey: string;
  /** Base URL of the FlexDB service. */
  baseUrl: string;
  /** Default namespace for every operation. Can be overridden per-hook. */
  namespace?: string;
  /**
   * Retry behaviour. Pass `false` to disable entirely.
   * @default { times: 3, delay: 10 }
   */
  retry?: RetryConfig | false;
}

// ── Search params / filters ────────────────────────────────────────────────

/** JSON-serialisable values accepted in searchParams. */
export type SearchParamValue =
  | string
  | number
  | boolean
  | null
  | (string | number | boolean | null)[];

/** Key-value map sent in X-Search-Params during create / update. */
export type SearchParams = Record<string, SearchParamValue>;

/** Filter operators for a single indexed field. */
export interface FilterOperators {
  eq?:  SearchParamValue; // exact match
  neq?: SearchParamValue; // not equal
  gt?:  SearchParamValue; // greater than
  gte?: SearchParamValue; // greater than or equal
  lt?:  SearchParamValue; // less than
  lte?: SearchParamValue; // less than or equal
  inc?: SearchParamValue; // string contains / array includes
  sw?:  SearchParamValue; // starts with
  ex?:  boolean;          // exists (true) / does not exist (false)
}

/** Filter map for `search` — each key is a previously-indexed field. */
export type Filters = Record<string, FilterOperators>;

// ── API response shapes (raw JSON from the server) ─────────────────────────

export interface CreateResponse {
  success: true;
  key: string;
}

export interface SetResponse {
  success: true;
  key: string;
}

export interface GetResponse<T = unknown> {
  success: true;
  item: T;
}

export interface DeleteResponse {
  success: true;
}

export interface ListIdsResponse {
  ids: string[];
  nextCursor?: string;
}

export interface ListItemsResponse<T = unknown> {
  items: { id: string; data: T | null }[];
  nextCursor?: string;
}

// ── Errors ─────────────────────────────────────────────────────────────────

/**
 * Thrown when the server returns a non-2xx status.
 * Inspect `.status` and `.body` for details.
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
 * Thrown when the HTTP request itself fails (network error, DNS, timeout).
 */
export class FlexDBNetworkError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name  = "FlexDBNetworkError";
    this.cause = cause;
  }
}

// ── React hook state shapes ────────────────────────────────────────────────

/**
 * Base shape shared by every hook's returned state object.
 * `data` starts as `null`, is populated on success, and stays populated
 * across subsequent executions so the UI never flashes to empty.
 */
export interface HookState<T> {
  /** The result of the last successful operation, or `null` if never run. */
  data:    T | null;
  /** `true` while a request is in-flight. */
  loading: boolean;
  /** The last error, or `null` if the last call succeeded. */
  error:   FlexDBError | FlexDBNetworkError | Error | null;
}

// ── useGet state ───────────────────────────────────────────────────────────

export interface UseGetState<T> extends HookState<T> {
  /** Call to manually refetch. */
  refetch: () => void;
}

// ── useMutation state ──────────────────────────────────────────────────────

/**
 * Returned by `useCreate`, `useSet`, `useDelete`.
 * `execute` is stable across renders (wrapped in useCallback).
 */
export interface UseMutationState<TArgs, TResult> extends HookState<TResult> {
  /** Trigger the mutation. Returns the result or throws. */
  execute: (args: TArgs) => Promise<TResult>;
  /** Manually clear data + error and reset to initial state. */
  reset:   () => void;
}

// ── useList / useSearch state ──────────────────────────────────────────────

export interface PaginatedState<T> extends HookState<T[]> {
  /** Opaque token for the current last-fetched page. */
  cursor:    string | undefined;
  /** `true` when more pages are available server-side. */
  hasMore:   boolean;
  /** Fetch the first page (resets accumulated data). */
  fetch:     () => void;
  /** Append the next page to `data`. No-op if `hasMore` is false. */
  fetchMore: () => void;
}