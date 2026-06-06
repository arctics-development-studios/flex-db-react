/**
 * # FlexDB React SDK
 *
 * React hooks and a context provider for **FlexDB** — a high-performance
 * distributed key-value store. Built as a thin React layer over
 * `@arctics/flex-db-sdk`. Drop the provider in once, then read and mutate
 * data from any component with a single hook call.
 *
 * ## Installation
 *
 * ```jsonc
 * // deno.json
 * {
 *   "imports": {
 *     "@arctics/flex-db-react": "jsr:@arctics/flex-db-react@^2.6.2",
 *     "react": "npm:react@^18.0.0"
 *   }
 * }
 * ```
 *
 * ## Setup — wrap your app with `FlexDBProvider`
 *
 * ```tsx
 * import { FlexDBProvider } from "@arctics/flex-db-react";
 *
 * const config = {
 *   apiKey:    import.meta.env.VITE_FLEXDB_KEY,
 *   baseUrl:   "https://eu.flex.arctics.dev",
 *   namespace: "users", // optional default namespace
 * };
 *
 * createRoot(document.getElementById("root")!).render(
 *   <FlexDBProvider config={config}>
 *     <App />
 *   </FlexDBProvider>
 * );
 * ```
 *
 * Every FlexDB hook in the tree shares this one client instance.
 *
 * ## Reading data — `useGet`
 *
 * ```tsx
 * import { useGet } from "@arctics/flex-db-react";
 *
 * function UserCard({ userId }: { userId: string }) {
 *   const { data, loading, error } = useGet<User>(userId);
 *
 *   if (loading) return <Spinner />;
 *   if (error)   return <p>Error: {error.message}</p>;
 *   return <div>{data?.name}</div>;
 * }
 * ```
 *
 * ## Creating data — `useCreate`
 *
 * ```tsx
 * import { useCreate } from "@arctics/flex-db-react";
 *
 * function NewUserForm() {
 *   const { execute, loading } = useCreate({ namespace: "users" });
 *
 *   const handleSubmit = async (form: UserForm) => {
 *     const { key } = await execute({
 *       value: { name: form.name, age: form.age },
 *       sp:    { age: form.age, role: form.role },
 *     });
 *     console.log("Saved as:", key);
 *   };
 *
 *   return <button onClick={handleSubmit} disabled={loading}>Save</button>;
 * }
 * ```
 *
 * ## Paginated lists — `useList` / `useListHydrated`
 *
 * ```tsx
 * import { useList } from "@arctics/flex-db-react";
 *
 * function UserList() {
 *   const { data, hasMore, fetchMore, loading } = useList({ limit: 20 });
 *
 *   return (
 *     <>
 *       <ul>{data?.map(id => <li key={id}>{id}</li>)}</ul>
 *       {hasMore && <button onClick={fetchMore} disabled={loading}>Load more</button>}
 *     </>
 *   );
 * }
 * ```
 *
 * ## Reactive search — `useSearch`
 *
 * ```tsx
 * import { useSearch } from "@arctics/flex-db-react";
 *
 * function ProductSearch() {
 *   const [minPrice, setMinPrice] = useState(0);
 *
 *   // Stabilise with useMemo — a new object reference triggers a re-fetch
 *   const filters = useMemo(() => ({
 *     price:    { gte: minPrice },
 *     category: { eq: "electronics" },
 *   }), [minPrice]);
 *
 *   const { data, hasMore, fetchMore } = useSearch(filters, { namespace: "products" });
 *
 *   return (
 *     <>
 *       <input type="number" value={minPrice} onChange={e => setMinPrice(+e.target.value)} />
 *       <ul>{data?.map(id => <li key={id}>{id}</li>)}</ul>
 *       {hasMore && <button onClick={fetchMore}>Load more</button>}
 *     </>
 *   );
 * }
 * ```
 *
 * ## Error handling
 *
 * ```tsx
 * import { FlexDBError, FlexDBNetworkError } from "@arctics/flex-db-react";
 *
 * const { error } = useGet("some-key");
 *
 * if (error instanceof FlexDBError) {
 *   if (error.code === "ERR_NOT_FOUND") console.error("Not found");
 * } else if (error instanceof FlexDBNetworkError) {
 *   console.error("Network error:", error.cause);
 * }
 * ```
 *
 * ## Escape hatch — direct client access
 *
 * ```tsx
 * import { useFlexDB } from "@arctics/flex-db-react";
 *
 * function MyComponent() {
 *   const client = useFlexDB();
 *
 *   const handleAction = async () => {
 *     const { data } = await client.get<User>("abc123", { namespace: "users" });
 *     console.log(data.name);
 *   };
 * }
 * ```
 *
 * @module
 */

// ─────────────────────────────────────────────
//  FlexDB React SDK · Public API
//  Import everything you need from this one file.
// ─────────────────────────────────────────────

// ── Provider & context ─────────────────────────────────────────────────────
export { FlexDBProvider, useFlexDB } from "./src/context.tsx";
export type { FlexDBConfig, FlexDBProviderProps } from "./src/context.tsx";

// ── Hooks ──────────────────────────────────────────────────────────────────
export { useHealth }                           from "./src/hooks/useHealth.tsx";
export { useGet }                              from "./src/hooks/useGet.tsx";
export { useCreate }                           from "./src/hooks/useCreate.tsx";
export { useSet }                              from "./src/hooks/useSet.tsx";
export { useDelete }                           from "./src/hooks/useDelete.tsx";
export { useList, useListHydrated }            from "./src/hooks/useList.tsx";
export { useSearch, useSearchHydrated }        from "./src/hooks/useSearch.tsx";
export { useBulkCreate }                       from "./src/hooks/useBulkCreate.tsx";
export { useBulkSet }                          from "./src/hooks/useBulkSet.tsx";
export { useBulkDelete }                       from "./src/hooks/useBulkDelete.tsx";

// ── Base SDK client (escape hatch) ─────────────────────────────────────────
// Re-exported from @arctics/flex-db-sdk for direct use when hooks are not enough.
export { FlexDBClient, NamespacedClient, createClient } from "@arctics/flex-db-sdk";

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  // Config
  RetryConfig,
  FlexDBClientOptions,

  // Operation options
  OperationOptions,
  CreateOptions,
  SetOptions,
  GetOptions,
  DeleteOptions,
  ListOptions,
  SearchOptions,

  // Data shapes
  SearchParams,
  Filters,
  FilterOperators,

  // Bulk operation items
  BulkCreateItem,
  BulkSetItem,

  // Results
  HealthResult,
  CreateResult,
  SetResult,
  GetResult,
  DeleteResult,
  ListIdsResult,
  ListItemsResult,
  BulkGetItem,
  BulkGetResult,
  BulkCreateResultItem,
  BulkCreateResult,
  BulkSetResultItem,
  BulkSetResult,
  BulkDeleteResult,

  // React hook state shapes
  HookState,
  UseGetState,
  UseMutationState,
  PaginatedState,
} from "./src/core/types.tsx";

// ── Hook option and arg types ──────────────────────────────────────────────
export type { UseHealthState }                           from "./src/hooks/useHealth.tsx";
export type { UseGetOptions }                            from "./src/hooks/useGet.tsx";
export type { UseCreateOptions, CreateArgs }             from "./src/hooks/useCreate.tsx";
export type { UseSetOptions, SetArgs }                   from "./src/hooks/useSet.tsx";
export type { UseDeleteOptions, DeleteArgs }             from "./src/hooks/useDelete.tsx";
export type { UseListOptions, UseListHydratedOptions }   from "./src/hooks/useList.tsx";
export type { UseSearchOptions, UseSearchHydratedOptions } from "./src/hooks/useSearch.tsx";
export type { UseBulkCreateOptions, BulkCreateArgs }     from "./src/hooks/useBulkCreate.tsx";
export type { UseBulkSetOptions, BulkSetArgs }           from "./src/hooks/useBulkSet.tsx";
export type { UseBulkDeleteOptions, BulkDeleteArgs }     from "./src/hooks/useBulkDelete.tsx";

// ── Errors ─────────────────────────────────────────────────────────────────
// Re-exported from @arctics/flex-db-sdk — one authoritative source.
export { FlexDBError, FlexDBNetworkError } from "@arctics/flex-db-sdk";
