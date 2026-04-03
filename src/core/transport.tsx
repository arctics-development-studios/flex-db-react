// ─────────────────────────────────────────────
//  FlexDB React SDK · Transport
//  Identical retry logic to the base JS SDK.
//  Zero dependencies — native fetch only.
// ─────────────────────────────────────────────

import { FlexDBError, FlexDBNetworkError, RetryConfig } from "./types.tsx";

export interface RequestOptions {
  method:   "GET" | "POST" | "PUT" | "DELETE";
  path:     string;
  headers?: Record<string, string>;
  body?:    unknown;
  query?:   Record<string, string | number | boolean | undefined>;
  signal?:  AbortSignal;
}

export const DEFAULT_RETRY: RetryConfig = { times: 3, delay: 10 };

// ── Helpers ────────────────────────────────────────────────────────────────

function clampRetryTimes(n: number): number {
  return Math.min(Math.max(Math.floor(n), 0), 10);
}

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

// ── Core request ───────────────────────────────────────────────────────────

/**
 * Executes a fetch request with optional retry logic.
 * Identical contract to the base JS SDK transport.
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