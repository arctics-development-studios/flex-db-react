/**
 * React hook for checking FlexDB service liveness.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · useHealth
//  Checks service liveness. Useful for status indicators
//  and connection debugging during development.
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";

import { useFlexDB }     from "../context.tsx";
import type { HookState } from "../core/types.tsx";

/**
 * State returned by {@link useHealth}.
 *
 * Extends {@link HookState} with a `refetch` function for polling or
 * manual re-checks.
 */
export interface UseHealthState extends HookState<{ status: string }> {
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
 * Useful for connection status badges, health-check pages, and debugging
 * provider configuration during development.
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
 * @example Manual refresh button
 * ```tsx
 * function HealthCheck() {
 *   const { data, loading, error, refetch } = useHealth();
 *
 *   return (
 *     <div>
 *       <p>Status: {loading ? "…" : error ? "offline" : data?.status}</p>
 *       <button onClick={refetch} disabled={loading}>Re-check</button>
 *     </div>
 *   );
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

  const [data,    setData]    = useState<{ status: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<UseHealthState["error"]>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.health();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}