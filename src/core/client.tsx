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

export class FlexDBClient {
  readonly #baseUrl:    string;
  readonly #authHeader: string;
  readonly #namespace:  string | undefined;
  readonly #retry:      RetryConfig | false;

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

  #ns(override?: string): string {
    const ns = override ?? this.#namespace;
    if (!ns) {
      throw new Error(
        "[FlexDB] No namespace. Set one on FlexDBProvider or pass namespace to the hook.",
      );
    }
    return ns;
  }

  #req<T>(opts: RequestOptions, ns?: string, signal?: AbortSignal): Promise<T> {
    return request<T>(
      this.#baseUrl,
      this.#authHeader,
      { ...opts, signal },
      this.#retry,
    );
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  health(signal?: AbortSignal): Promise<{ status: string }> {
    return this.#req({ method: "GET", path: "/health" }, undefined, signal);
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  create(
    value:        unknown,
    namespace?:   string,
    searchParams?: SearchParams,
    signal?:      AbortSignal,
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

  set(
    key:          string,
    value:        unknown,
    namespace?:   string,
    searchParams?: SearchParams,
    signal?:      AbortSignal,
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

  list(opts: {
    namespace?: string;
    limit?:     number;
    cursor?:    string;
    hydrate?:   false;
    signal?:    AbortSignal;
  }): Promise<ListIdsResponse>;

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

  search(opts: {
    filters:    Filters;
    namespace?: string;
    limit?:     number;
    cursor?:    string;
    hydrate?:   false;
    signal?:    AbortSignal;
  }): Promise<ListIdsResponse>;

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