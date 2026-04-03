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
//  useFlexDB() gives hooks access to the shared client.
// ─────────────────────────────────────────────

import {
  createContext,
  ReactElement,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { FlexDBClient } from "./core/client.tsx";
import type { FlexDBConfig } from "./core/types.tsx";

// ── Context ────────────────────────────────────────────────────────────────

const FlexDBContext = createContext<FlexDBClient | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

/**
 * Props accepted by {@link FlexDBProvider}.
 */
export interface FlexDBProviderProps {
  /**
   * Client configuration. See {@link FlexDBConfig} for all available options.
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
 * the root of whatever subtree needs database access). Every call to
 * {@link useGet}, {@link useCreate}, {@link useList}, etc. will share the
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
 * @example Multiple providers for separate namespaces
 * ```tsx
 * // Different parts of the app can have their own provider
 * // with a different default namespace.
 * <FlexDBProvider config={{ ...baseConfig, namespace: "users" }}>
 *   <UserSection />
 * </FlexDBProvider>
 *
 * <FlexDBProvider config={{ ...baseConfig, namespace: "products" }}>
 *   <ProductSection />
 * </FlexDBProvider>
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
 * Returns the shared {@link FlexDBClient} instance from context.
 *
 * **Must be called inside a {@link FlexDBProvider}.** Throws a descriptive
 * error if no provider is found in the tree.
 *
 * You rarely need this directly — prefer the purpose-built hooks:
 * {@link useGet}, {@link useCreate}, {@link useSet}, {@link useDelete},
 * {@link useList}, {@link useListHydrated}, {@link useSearch},
 * {@link useSearchHydrated}.
 *
 * Use `useFlexDB` when you need **imperative** access — for example,
 * chaining multiple operations in a single event handler, or integrating
 * FlexDB into a non-hook callback.
 *
 * @returns The {@link FlexDBClient} instance provided by the nearest {@link FlexDBProvider}.
 *
 * @throws `Error` if called outside a {@link FlexDBProvider}.
 *
 * @example Imperative multi-step operation
 * ```tsx
 * function TransferButton({ fromKey, toKey }: { fromKey: string; toKey: string }) {
 *   const client = useFlexDB();
 *
 *   const handleTransfer = async () => {
 *     const { item } = await client.get(fromKey);
 *     await client.set(toKey, item);
 *     await client.delete(fromKey);
 *   };
 *
 *   return <button onClick={handleTransfer}>Transfer</button>;
 * }
 * ```
 *
 * @example Accessing the client in a custom hook
 * ```tsx
 * function useUserWithPosts(userId: string) {
 *   const client = useFlexDB();
 *   const [result, setResult] = useState(null);
 *
 *   useEffect(() => {
 *     Promise.all([
 *       client.get(`user:${userId}`),
 *       client.search({ filters: { authorId: { eq: userId } } }),
 *     ]).then(([user, posts]) => setResult({ user, posts }));
 *   }, [userId, client]);
 *
 *   return result;
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