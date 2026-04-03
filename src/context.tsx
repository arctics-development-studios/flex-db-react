// ─────────────────────────────────────────────
//  FlexDB React SDK · Context
//  FlexDBProvider wraps your app once.
//  useFlexDB() gives hooks access to the shared client.
// ─────────────────────────────────────────────

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { FlexDBClient } from "./core/client.tsx";
import type { FlexDBConfig } from "./core/types.tsx";

// ── Context ────────────────────────────────────────────────────────────────

const FlexDBContext = createContext<FlexDBClient | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export interface FlexDBProviderProps {
  config:   FlexDBConfig;
  children: ReactNode;
}

/**
 * Wrap your application (or a subtree) with `FlexDBProvider` once.
 * Every FlexDB hook in the tree will share this single client instance,
 * which means connection pooling and retry config are set in one place.
 *
 * @example
 * ```tsx
 * // main.tsx
 * <FlexDBProvider config={{ apiKey: "...", baseUrl: "...", namespace: "users" }}>
 *   <App />
 * </FlexDBProvider>
 * ```
 */
export function FlexDBProvider({ config, children }: FlexDBProviderProps) {
  // useMemo ensures the client is only recreated when config identity changes.
  // In practice, define `config` outside the component or with useMemo upstream
  // so it remains stable across renders.
  const client = useMemo(() => new FlexDBClient(config), [
    config.apiKey,
    config.baseUrl,
    config.namespace,
    // Stringify retry so primitive changes are caught
    JSON.stringify(config.retry),
  ]);

  return (
    <FlexDBContext.Provider value={client}>
      {children}
    </FlexDBContext.Provider>
  );
}

// ── useFlexDB ──────────────────────────────────────────────────────────────

/**
 * Returns the shared `FlexDBClient` from context.
 * Must be called inside a `FlexDBProvider`.
 *
 * You rarely need this directly — prefer the purpose-built hooks
 * (`useGet`, `useCreate`, `useList`, etc.).
 *
 * @example
 * ```tsx
 * const client = useFlexDB();
 * const result = await client.get("my-key");
 * ```
 */
export function useFlexDB(): FlexDBClient {
  const client = useContext(FlexDBContext);
  if (!client) {
    throw new Error(
      "[FlexDB] useFlexDB must be called inside <FlexDBProvider>. " +
      "Wrap your app (or subtree) with <FlexDBProvider config={...}>.",
    );
  }
  return client;
}