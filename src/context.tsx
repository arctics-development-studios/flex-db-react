/**
 * React context glue that distributes a shared {@link FlexDBClient} instance
 * to every hook in the component tree.
 *
 * **You only need two things from this module:**
 * - {@link FlexDBProvider} — mount it once at the root of your app.
 * - {@link useFlexDB} — access the client directly when hooks are not enough.
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · Context
//  FlexDBProvider wraps your app once.
//  useFlexDB() gives hooks access to the shared @arctics/flex-db-sdk client.
// ─────────────────────────────────────────────

import {
  createContext,
  ReactElement,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { FlexDBClient } from "@arctics/flex-db-sdk";
import type { FlexDBClientOptions } from "@arctics/flex-db-sdk";

/** Public alias for {@link FlexDBClientOptions}. Passed to {@link FlexDBProvider}. */
export type FlexDBConfig = FlexDBClientOptions;

// ── Context ────────────────────────────────────────────────────────────────

const FlexDBContext = createContext<FlexDBClient | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

/**
 * Props accepted by {@link FlexDBProvider}.
 */
export interface FlexDBProviderProps {
  /**
   * Client configuration. See {@link FlexDBClientOptions} for all available options.
   *
   * **Important:** define this object **outside** your component or memoise it
   * with `useMemo`. An unstable reference (a new object on every render) causes
   * the provider to re-create its internal {@link FlexDBClient} on every render,
   * which resets all hook state in the tree.
   *
   * ```tsx
   * // ✅ Stable — defined at module scope
   * const config: FlexDBConfig = {
   *   apiKey:  import.meta.env.VITE_FLEXDB_KEY,
   *   baseUrl: "https://eu.flex.arctics.dev",
   * };
   *
   * // ❌ Unstable — new object on every render
   * <FlexDBProvider config={{ apiKey: "...", baseUrl: "..." }}>
   * ```
   */
  config:   FlexDBConfig;
  /** The React subtree that will have access to all FlexDB hooks. */
  children: ReactNode;
}

/**
 * Provides a shared {@link FlexDBClient} to every FlexDB hook in the tree.
 *
 * Mount `FlexDBProvider` **once** near the root of your application (or at
 * the root of whatever subtree needs database access). Every hook shares the
 * same client instance, so connection settings and retry configuration are
 * defined in one place.
 *
 * The internal client is re-created only when `apiKey`, `baseUrl`,
 * `namespace`, or `retry` changes — not on every render.
 *
 * @example Minimal setup in `main.tsx`
 * ```tsx
 * import { FlexDBProvider } from "@arctics/flex-db-react";
 *
 * const config = {
 *   apiKey:    import.meta.env.VITE_FLEXDB_KEY,
 *   baseUrl:   "https://eu.flex.arctics.dev",
 *   namespace: "users",
 * };
 *
 * createRoot(document.getElementById("root")!).render(
 *   <FlexDBProvider config={config}>
 *     <App />
 *   </FlexDBProvider>
 * );
 * ```
 *
 * @example Disabling retries for a development build
 * ```tsx
 * const config = {
 *   apiKey:  import.meta.env.VITE_FLEXDB_KEY,
 *   baseUrl: "https://eu.flex.arctics.dev",
 *   retry:   import.meta.env.DEV ? false : { times: 3, delay: 10 },
 * };
 * ```
 */
export function FlexDBProvider({ config, children }: FlexDBProviderProps): ReactElement<any, any> {
  const client = useMemo(() => new FlexDBClient(config), [
    config.apiKey,
    config.baseUrl,
    config.namespace,
    // Stringify retry so primitive changes (times/delay) are detected
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
 * Returns the shared {@link FlexDBClient} instance from context.
 *
 * **Must be called inside a {@link FlexDBProvider}.** Throws a descriptive
 * error if no provider is found in the tree.
 *
 * You rarely need this directly — prefer the purpose-built hooks such as
 * {@link useGet}, {@link useCreate}, {@link useList}, or {@link useSearch}.
 *
 * Use `useFlexDB` when you need **imperative** access — for example, chaining
 * multiple operations in a single event handler.
 *
 * @returns The {@link FlexDBClient} instance provided by the nearest {@link FlexDBProvider}.
 * @throws `Error` if called outside a {@link FlexDBProvider}.
 *
 * @example Imperative multi-step operation
 * ```tsx
 * function TransferButton({ fromKey, toKey }: { fromKey: string; toKey: string }) {
 *   const client = useFlexDB();
 *
 *   const handleTransfer = async () => {
 *     const { data } = await client.get(fromKey, { namespace: "items" });
 *     await client.set(toKey, data, { namespace: "items" });
 *     await client.delete(fromKey, { namespace: "items" });
 *   };
 *
 *   return <button onClick={handleTransfer}>Transfer</button>;
 * }
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
