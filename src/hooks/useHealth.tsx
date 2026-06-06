/**
 * React hook for checking FlexDB service liveness.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useHealth
//  Pings the service on mount. No auth required.
//  Delegates to FlexDBClient.health() from @arctics/flex-db-sdk.
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";

import { useFlexDB }      from "../context.tsx";
import type { HealthResult, HookState } from "../core/types.tsx";

/**
 * State returned by {@link useHealth}.
 *
 * Extends {@link HookState} with a `refetch` function for polling or
 * manual re-checks.
 */
export interface UseHealthState extends HookState<HealthResult> {
  /**
   * Manually re-pings the service.
   * Call this to re-check after an error, or to implement a periodic poll.
   */
  refetch: () => void;
}

/**
 * Pings the FlexDB service and tracks its liveness in component state.
 *
 * - **Auto-runs once on mount** — no arguments required.
 * - **No authentication needed** — safe to call before a user is signed in.
 * - `data.status` is `"ok"` when the service is healthy.
 * - `error` is set when the service is unreachable or returns an error status.
 * - Call `refetch()` to re-ping on demand (e.g. after recovering from offline).
 *
 * @returns {@link UseHealthState} with `data`, `loading`, `error`, and `refetch`.
 *
 * @example Connection status badge
 * ```tsx
 * import { useHealth } from "@arctics/flex-db-react";
 *
 * function StatusBadge() {
 *   const { data, loading, error } = useHealth();
 *
 *   if (loading) return <span>Checking…</span>;
 *   if (error)   return <span style={{ color: "red" }}>⚠ Offline</span>;
 *   return <span style={{ color: "green" }}>✓ {data?.status}</span>;
 * }
 * ```
 *
 * @example Periodic polling every 30 seconds
 * ```tsx
 * function PollingStatusBadge() {
 *   const { data, error, refetch } = useHealth();
 *
 *   useEffect(() => {
 *     const interval = setInterval(refetch, 30_000);
 *     return () => clearInterval(interval);
 *   }, [refetch]);
 *
 *   return <span>{error ? "⚠ Offline" : `✓ ${data?.status}`}</span>;
 * }
 * ```
 */
export function useHealth(): UseHealthState {
  const client = useFlexDB();

  const [data,    setData]    = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<UseHealthState["error"]>(null);

  // Tracks mount state so we never call setState after unmount
  const mountedRef = useRef(false);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);

    client.health().then(
      (result) => {
        if (!mountedRef.current) return;
        setData(result);
        setLoading(false);
      },
      (err: unknown) => {
        if (!mountedRef.current) return;
        setError(err as Error);
        setLoading(false);
      },
    );
  }, [client]);

  useEffect(() => {
    mountedRef.current = true;
    refetch();
    return () => { mountedRef.current = false; };
  }, [refetch]);

  return { data, loading, error, refetch };
}
