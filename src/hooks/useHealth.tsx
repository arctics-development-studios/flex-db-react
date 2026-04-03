// ─────────────────────────────────────────────
//  FlexDB React SDK · useHealth
//  Checks service liveness. Useful for status indicators
//  and connection debugging during development.
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";

import { useFlexDB }     from "../context.tsx";
import type { HookState } from "../core/types.tsx";

export interface UseHealthState extends HookState<{ status: string }> {
  refetch: () => void;
}

/**
 * Pings the service and tracks its liveness in state.
 * Auto-runs on mount. No auth required.
 *
 * @example
 * ```tsx
 * function StatusBadge() {
 *   const { data, loading, error } = useHealth();
 *
 *   if (loading) return <span>Checking…</span>;
 *   if (error)   return <span style={{ color: "red" }}>⚠ Offline</span>;
 *   return <span style={{ color: "green" }}>✓ {data?.status}</span>;
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