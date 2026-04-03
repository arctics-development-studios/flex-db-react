/**
 * Zero-dependency HTTP transport layer shared by the FlexDB React SDK.
 *
 * Handles URL construction, request serialisation, fixed-delay retry
 * logic, and error wrapping. This module is internal — all public
 * functionality is exposed through {@link FlexDBClient} and the React hooks.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · Transport
//  Zero-dependency fetch wrapper with retry and
//  structured error handling.
// ─────────────────────────────────────────────

import { FlexDBError, FlexDBNetworkError, RetryConfig } from "./types.tsx";

/**
 * Descriptor for a single outgoing HTTP request.
 * Consumed internally by {@link request} — not part of the public API.
 */
export interface RequestOptions {
  /** HTTP method for this request. */
  method:   "GET" | "POST" | "PUT" | "DELETE";
  /** Path appended to the client's `baseUrl`, e.g. `"/v1/list"`. */
  path:     string;
  /**
   * Additional headers merged on top of the default
   * `Authorization` and `Content-Type` headers.
   */
  headers?: Record<string, string>;
  /** Request body. Serialised to JSON automatically. */
  body?:    unknown;
  /**
   * Query-string parameters appended to the URL.
   * `undefined` values are omitted from the query string.
   */
  query?:   Record<string, string | number | boolean | undefined>;
  /**
   * Optional `AbortSignal` for cancellation.
   * When fired, the in-flight fetch is aborted and an `AbortError` is thrown.
   * Retries are never attempted after an abort.
   */
  signal?:  AbortSignal;
}

/**
 * Default {@link RetryConfig} applied when no `retry` option is provided
 * in {@link FlexDBConfig}.
 *
 * - `times: 3` — up to 3 retries after the first failure
 * - `delay: 10` — 10 ms fixed delay between attempts
 */
export const DEFAULT_RETRY: RetryConfig = { times: 3, delay: 10 };

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Clamps the retry `times` value to the inclusive range `[0, 10]` and
 * floors it to an integer, guarding against out-of-range user config.
 *
 * @param n - Raw retry count from user configuration.
 * @returns Clamped integer in `[0, 10]`.
 */
function clampRetryTimes(n: number): number {
  return Math.min(Math.max(Math.floor(n), 0), 10);
}

/**
 * Constructs a full request URL by joining `baseUrl` and `path`, then
 * appending a URL-encoded query string from `query` (skipping `undefined`
 * values).
 *
 * @param baseUrl - Client base URL. A trailing slash is stripped.
 * @param path    - API path such as `"/v1/list"`.
 * @param query   - Optional key-value query parameters.
 * @returns Fully-formed URL string ready to pass to `fetch`.
 */
function buildUrl(
  baseUrl: string,
  path:    string,
  query?:  Record<string, string | number | boolean | undefined>,
): string {
  const base = baseUrl.replace(/\/$/, "");
  let url = `${base}${path}`;

  if (!query) return url;

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }

  const qs = params.toString();
  if (qs) url += `?${qs}`;
  return url;
}

/**
 * Returns a promise that resolves after `ms` milliseconds.
 * Used to implement the fixed delay between retry attempts.
 *
 * @param ms - Duration in milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns `true` for HTTP status codes that represent transient
 * server-side conditions worth retrying.
 *
 * - `429` — rate limited
 * - `5xx` — server error
 *
 * Client errors (`4xx` except `429`) are considered permanent and are never
 * retried.
 *
 * @param status - HTTP response status code.
 */
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

// ── Core request ───────────────────────────────────────────────────────────

/**
 * Executes a fetch request against the FlexDB API with optional retry logic.
 *
 * **Retry behaviour**
 * - Network failures, HTTP `429`, and HTTP `5xx` responses are retried up to
 *   `retry.times` additional times with a fixed `retry.delay` ms delay.
 * - `AbortError` (component unmounted or signal fired) is rethrown immediately
 *   without retrying.
 * - HTTP `4xx` errors (except `429`) are thrown immediately as
 *   {@link FlexDBError} without retrying.
 *
 * **Response parsing**
 * - JSON is returned when the server sends `Content-Type: application/json`.
 * - Empty responses (e.g. `204 No Content`) return `undefined`.
 *
 * @param baseUrl    - Base URL of the FlexDB service.
 * @param authHeader - Pre-formatted `Authorization` header value, e.g. `"Bearer <token>"`.
 * @param opts       - Request descriptor. See {@link RequestOptions}.
 * @param retry      - Retry configuration, or `false` to make a single attempt.
 * @returns The parsed JSON response body, typed as `T`.
 *
 * @throws {@link FlexDBError} When the server responds with a non-2xx status.
 * @throws {@link FlexDBNetworkError} When `fetch` itself throws (DNS, connection refused, etc.).
 */
export async function request<T = unknown>(
  baseUrl:    string,
  authHeader: string,
  opts:       RequestOptions,
  retry:      RetryConfig | false,
): Promise<T> {
  const url = buildUrl(baseUrl, opts.path, opts.query);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization:  authHeader,
    ...opts.headers,
  };

  const fetchInit: RequestInit = {
    method:  opts.method,
    headers,
    signal:  opts.signal,
  };

  if (opts.body !== undefined) {
    fetchInit.body = JSON.stringify(opts.body);
  }

  const maxAttempts = retry === false ? 1 : 1 + clampRetryTimes(retry.times);
  const retryDelay  = retry === false ? 0 : Math.max(0, retry.delay);

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, fetchInit);

      if (response.ok) {
        const ct = response.headers.get("Content-Type") ?? "";
        if (ct.includes("application/json")) {
          return (await response.json()) as T;
        }
        return undefined as unknown as T;
      }

      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text().catch(() => undefined);
      }

      const message =
        typeof errorBody === "object" &&
        errorBody !== null &&
        "error" in errorBody
          ? String((errorBody as { error: unknown }).error)
          : `HTTP ${response.status}`;

      const err = new FlexDBError(response.status, message, errorBody);

      if (attempt < maxAttempts && isRetryable(response.status)) {
        lastError = err;
        await sleep(retryDelay);
        continue;
      }

      throw err;

    } catch (err) {
      if (err instanceof FlexDBError) throw err;

      // AbortError — never retry (component unmounted or user cancelled)
      if (err instanceof Error && err.name === "AbortError") throw err;

      lastError = new FlexDBNetworkError(
        `Request failed (attempt ${attempt}/${maxAttempts}): ${
          err instanceof Error ? err.message : String(err)
        }`,
        err,
      );

      if (attempt < maxAttempts) {
        await sleep(retryDelay);
        continue;
      }

      throw lastError;
    }
  }

  throw lastError;
}