/**
 * The core HTTP client for the FlexDB React SDK.
 *
 * Framework-agnostic — can be used outside React via the `useFlexDB()` escape
 * hatch or by instantiating directly. All React hooks consume this internally.
 *
 * You do not normally import from this module directly. Use
 * `@arctics/flex-db-react` and access the client via {@link useFlexDB} when
 * you need imperative access.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · Client
//  Same API surface as the base JS SDK.
//  Framework-agnostic — can be used outside React.
//  The React hooks consume this internally.
// ─────────────────────────────────────────────

import { request, DEFAULT_RETRY } from "./transport.tsx";
import type { RequestOptions } from "./transport.tsx";
import type {
  FlexDBConfig,
  RetryConfig,
  SearchParams,
  Filters,
  CreateResponse,
  SetResponse,
  GetResponse,
  DeleteResponse,
  ListIdsResponse,
  ListItemsResponse,
} from "./types.tsx";

/**
 * The underlying HTTP client shared across all FlexDB React hooks.
 *
 * An instance is created automatically by {@link FlexDBProvider} and
 * distributed to hooks via React context. You can obtain it in any component
 * by calling {@link useFlexDB}:
 *
 * ```tsx
 * import { useFlexDB } from "@arctics/flex-db-react";
 *
 * function MyComponent() {
 *   const client = useFlexDB();
 *   const { item } = await client.get<User>("abc123");
 * }
 * ```
 *
 * ### Direct instantiation (outside React)
 *
 * You can also create a client directly for use in server-side code or
 * utility scripts — it has no React dependency:
 *
 * ```ts
 * import { FlexDBClient } from "@arctics/flex-db-react";
 *
 * const client = new FlexDBClient({
 *   apiKey:    Deno.env.get("FLEXDB_API_KEY")!,
 *   baseUrl:   "https://eu.flex.arctics.dev",
 *   namespace: "users",
 * });
 *
 * const { key } = await client.create({ name: "Alice" });
 * ```
 */
export class FlexDBClient {
  readonly #baseUrl:    string;
  readonly #authHeader: string;
  readonly #namespace:  string | undefined;
  readonly #retry:      RetryConfig | false;

  /**
   * @param config - Client configuration. See {@link FlexDBConfig}.
   * @throws `Error` if `apiKey` or `baseUrl` is not provided.
   */
  constructor(config: FlexDBConfig) {
    if (!config.apiKey)  throw new Error("[FlexDB] apiKey is required.");
    if (!config.baseUrl) throw new Error("[FlexDB] baseUrl is required.");

    this.#baseUrl    = config.baseUrl.replace(/\/$/, "");
    this.#authHeader = `Bearer ${config.apiKey}`;
    this.#namespace  = config.namespace;
    this.#retry      = config.retry === false
      ? false
      : { ...DEFAULT_RETRY, ...(config.retry ?? {}) };
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  /** Resolves the effective namespace, throwing if neither an override nor a default is set. */
  #ns(override?: string): string {
    const ns = override ?? this.#namespace;
    if (!ns) {
      throw new Error(
        "[FlexDB] No namespace. Set one on FlexDBProvider or pass namespace to the hook.",
      );
    }
    return ns;
  }

  /** Central request dispatcher — keeps individual method call-sites clean. */
  #req<T>(opts: RequestOptions, ns?: string, signal?: AbortSignal): Promise<T> {
    return request<T>(
      this.#baseUrl,
      this.#authHeader,
      { ...opts, signal },
      this.#retry,
    );
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  /**
   * Pings the FlexDB service to verify it is reachable and healthy.
   * Authentication is **not** required for this endpoint.
   *
   * Prefer the {@link useHealth} hook in React components.
   *
   * @param signal - Optional `AbortSignal` for cancellation.
   * @returns `{ status: "ok" }` when the service is healthy.
   *
   * @example
   * ```ts
   * const { status } = await client.health();
   * console.log(status); // "ok"
   * ```
   */
  health(signal?: AbortSignal): Promise<{ status: string }> {
    return this.#req({ method: "GET", path: "/health" }, undefined, signal);
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  /**
   * Creates a new item with a **server-generated** NanoID key.
   *
   * Use when you do not need to control the key. To supply your own key,
   * use {@link set} instead.
   *
   * To make the item queryable, pass `searchParams` with the fields you want
   * to index. They are stored separately from `value` and power all
   * {@link search} queries.
   *
   * Prefer the {@link useCreate} hook in React components.
   *
   * @param value        - Any JSON-serialisable object to store.
   * @param namespace    - Namespace override. Falls back to the client-level default.
   * @param searchParams - Fields to index for future search queries.
   * @param signal       - Optional `AbortSignal` for cancellation.
   * @returns `{ success: true, key }` — store the `key`, it is the only way to retrieve this item.
   *
   * @throws {@link FlexDBError} On non-2xx server responses.
   * @throws {@link FlexDBNetworkError} When the request fails to reach the server.
   *
   * @example
   * ```ts
   * const { key } = await client.create(
   *   { name: "Alice", age: 30 },
   *   "users",
   *   { age: 30, role: "viewer" },
   * );
   * console.log(key); // "V1StGXR8_Z5jdHi6B-myT"
   * ```
   */
  create(
    value:         unknown,
    namespace?:    string,
    searchParams?: SearchParams,
    signal?:       AbortSignal,
  ): Promise<CreateResponse> {
    const headers: Record<string, string> = { "X-Namespace": this.#ns(namespace) };
    if (searchParams) headers["X-Search-Params"] = JSON.stringify(searchParams);

    return this.#req(
      { method: "POST", path: "/v1", headers, body: value },
      namespace,
      signal,
    );
  }

  // ── Get ────────────────────────────────────────────────────────────────────

  /**
   * Retrieves a single item by its unique key.
   *
   * Supply the data type as a generic parameter to get a fully-typed result:
   *
   * ```ts
   * const { item } = await client.get<User>("abc123");
   * console.log(item.name); // TypeScript knows `name` is a string
   * ```
   *
   * Prefer the {@link useGet} hook in React components — it auto-fetches on
   * mount, handles cancellation on unmount, and keeps `data` stable during
   * background refreshes.
   *
   * @param key       - The key returned by {@link create} or passed to {@link set}.
   * @param namespace - Namespace override. Falls back to the client-level default.
   * @param signal    - Optional `AbortSignal` for cancellation.
   * @returns `{ success: true, item: T }`.
   *
   * @throws {@link FlexDBError} with `status === 404` if the key does not exist.
   * @throws {@link FlexDBError} with `status === 401` if the API key is invalid.
   * @throws {@link FlexDBNetworkError} When the request fails to reach the server.
   *
   * @example
   * ```ts
   * const { item } = await client.get<User>("abc123", "users");
   * console.log(item.name, item.age);
   * ```
   */
  get<T = unknown>(
    key:        string,
    namespace?: string,
    signal?:    AbortSignal,
  ): Promise<GetResponse<T>> {
    return this.#req(
      {
        method:  "GET",
        path:    `/v1/${encodeURIComponent(key)}`,
        headers: { "X-Namespace": this.#ns(namespace) },
      },
      namespace,
      signal,
    );
  }

  // ── Set ────────────────────────────────────────────────────────────────────

  /**
   * Upserts an item at a **caller-supplied** key.
   *
   * - If the key does not exist, a new item is created.
   * - If the key already exists, the stored value is **replaced entirely**
   *   (this is not a partial patch).
   *
   * Use when you control the key — for example, storing a record under a
   * user's UUID. For server-generated keys, use {@link create}.
   *
   * Prefer the {@link useSet} hook in React components.
   *
   * @param key          - Your chosen key. Any non-empty string is valid.
   * @param value        - Any JSON-serialisable object.
   * @param namespace    - Namespace override. Falls back to the client-level default.
   * @param searchParams - Fields to index for future search queries.
   * @param signal       - Optional `AbortSignal` for cancellation.
   * @returns `{ success: true, key }`.
   *
   * @throws {@link FlexDBError} On non-2xx server responses.
   * @throws {@link FlexDBNetworkError} When the request fails to reach the server.
   *
   * @example
   * ```ts
   * await client.set(
   *   "user-42",
   *   { name: "Bob", age: 25 },
   *   "users",
   *   { age: 25, role: "viewer" },
   * );
   * ```
   */
  set(
    key:           string,
    value:         unknown,
    namespace?:    string,
    searchParams?: SearchParams,
    signal?:       AbortSignal,
  ): Promise<SetResponse> {
    const headers: Record<string, string> = { "X-Namespace": this.#ns(namespace) };
    if (searchParams) headers["X-Search-Params"] = JSON.stringify(searchParams);

    return this.#req(
      {
        method:  "PUT",
        path:    `/v1/${encodeURIComponent(key)}`,
        headers,
        body:    value,
      },
      namespace,
      signal,
    );
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  /**
   * Permanently removes an item from the store.
   *
   * This operation is **irreversible**. Both the item data and its search
   * index entries are deleted.
   *
   * Prefer the {@link useDelete} hook in React components.
   *
   * @param key       - The key of the item to delete.
   * @param namespace - Namespace override. Falls back to the client-level default.
   * @param signal    - Optional `AbortSignal` for cancellation.
   * @returns `{ success: true }`.
   *
   * @throws {@link FlexDBError} with `status === 404` if the key does not exist.
   * @throws {@link FlexDBNetworkError} When the request fails to reach the server.
   *
   * @example
   * ```ts
   * await client.delete("user-42", "users");
   * ```
   */
  delete(
    key:        string,
    namespace?: string,
    signal?:    AbortSignal,
  ): Promise<DeleteResponse> {
    return this.#req(
      {
        method:  "DELETE",
        path:    `/v1/${encodeURIComponent(key)}`,
        headers: { "X-Namespace": this.#ns(namespace) },
      },
      namespace,
      signal,
    );
  }

  // ── List ───────────────────────────────────────────────────────────────────

  /**
   * Lists items in the namespace, returning only their **keys** (IDs).
   *
   * Prefer the {@link useList} hook in React components — it manages cursor
   * state and provides `fetchMore` for infinite-scroll patterns.
   *
   * @param opts.namespace - Namespace override.
   * @param opts.limit     - Items per page. Max 100. Defaults to 20.
   * @param opts.cursor    - Pagination cursor from the previous response's `nextCursor`.
   * @param opts.hydrate   - Must be `false` or omitted for this overload.
   * @param opts.signal    - Optional `AbortSignal` for cancellation.
   * @returns `{ ids: string[], nextCursor?: string }`.
   *
   * @example Manual cursor pagination
   * ```ts
   * let cursor: string | undefined;
   * do {
   *   const result = await client.list({ namespace: "users", limit: 50, cursor });
   *   console.log(result.ids);
   *   cursor = result.nextCursor;
   * } while (cursor);
   * ```
   */
  list(opts: {
    namespace?: string;
    limit?:     number;
    cursor?:    string;
    hydrate?:   false;
    signal?:    AbortSignal;
  }): Promise<ListIdsResponse>;

  /**
   * Lists items in the namespace, returning their **full data objects**.
   *
   * Requires `limit` ≤ 20 (server constraint for hydrated responses).
   * Each result entry is `{ id: string; data: T | null }`.
   *
   * Prefer the {@link useListHydrated} hook in React components.
   *
   * @param opts.hydrate - Must be `true` for this overload.
   * @param opts.limit   - Must be ≤ 20 when `hydrate` is `true`.
   * @returns `{ items: { id, data }[], nextCursor?: string }`.
   *
   * @example
   * ```ts
   * const { items } = await client.list<User>({ namespace: "users", hydrate: true, limit: 20 });
   * for (const { id, data } of items) console.log(id, data?.name);
   * ```
   */
  list<T>(opts: {
    namespace?: string;
    limit?:     number;
    cursor?:    string;
    hydrate:    true;
    signal?:    AbortSignal;
  }): Promise<ListItemsResponse<T>>;

  list<T = unknown>(opts: {
    namespace?: string;
    limit?:     number;
    cursor?:    string;
    hydrate?:   boolean;
    signal?:    AbortSignal;
  }): Promise<ListIdsResponse | ListItemsResponse<T>> {
    const headers: Record<string, string> = { "X-Namespace": this.#ns(opts.namespace) };
    if (opts.hydrate) headers["X-Full-Object"] = "true";

    const query: Record<string, string | number | boolean | undefined> = {
      limit:  opts.limit,
      cursor: opts.cursor,
    };

    return this.#req(
      { method: "GET", path: "/v1/list", headers, query },
      opts.namespace,
      opts.signal,
    );
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  /**
   * Searches indexed items using {@link Filters}, returning only their **keys** (IDs).
   *
   * Items must have been written with `searchParams` for the queried fields to
   * be available. See {@link create} and {@link set}.
   *
   * Prefer the {@link useSearch} hook in React components — it re-runs
   * automatically when filters change and manages cursor state for pagination.
   *
   * @param opts.filters   - Filter expressions evaluated server-side. See {@link Filters}.
   * @param opts.namespace - Namespace override.
   * @param opts.limit     - Items per page. Max 100. Defaults to 20.
   * @param opts.cursor    - Pagination cursor from the previous response's `nextCursor`.
   * @param opts.hydrate   - Must be `false` or omitted for this overload.
   * @param opts.signal    - Optional `AbortSignal` for cancellation.
   * @returns `{ ids: string[], nextCursor?: string }`.
   *
   * @example
   * ```ts
   * const { ids } = await client.search({
   *   namespace: "products",
   *   filters:   { price: { gte: 10, lte: 100 }, category: { eq: "books" } },
   * });
   * ```
   */
  search(opts: {
    filters:    Filters;
    namespace?: string;
    limit?:     number;
    cursor?:    string;
    hydrate?:   false;
    signal?:    AbortSignal;
  }): Promise<ListIdsResponse>;

  /**
   * Searches indexed items and returns their **full data objects**.
   *
   * Requires `limit` ≤ 20 (server constraint for hydrated responses).
   *
   * Prefer the {@link useSearchHydrated} hook in React components.
   *
   * @param opts.hydrate - Must be `true` for this overload.
   * @param opts.limit   - Must be ≤ 20 when `hydrate` is `true`.
   * @returns `{ items: { id, data }[], nextCursor?: string }`.
   *
   * @example
   * ```ts
   * const { items } = await client.search<Product>({
   *   namespace: "products",
   *   filters:   { category: { sw: "elec" } },
   *   hydrate:   true,
   *   limit:     10,
   * });
   * for (const { id, data } of items) console.log(id, data?.title);
   * ```
   */
  search<T>(opts: {
    filters:    Filters;
    namespace?: string;
    limit?:     number;
    cursor?:    string;
    hydrate:    true;
    signal?:    AbortSignal;
  }): Promise<ListItemsResponse<T>>;

  search<T = unknown>(opts: {
    filters:    Filters;
    namespace?: string;
    limit?:     number;
    cursor?:    string;
    hydrate?:   boolean;
    signal?:    AbortSignal;
  }): Promise<ListIdsResponse | ListItemsResponse<T>> {
    const headers: Record<string, string> = { "X-Namespace": this.#ns(opts.namespace) };
    if (opts.hydrate) headers["X-Full-Object"] = "true";

    const query: Record<string, string | number | boolean | undefined> = {
      limit:  opts.limit,
      cursor: opts.cursor,
    };

    return this.#req(
      { method: "POST", path: "/v1/search", headers, query, body: opts.filters },
      opts.namespace,
      opts.signal,
    );
  }
}