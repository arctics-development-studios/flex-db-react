/**
 * # FlexDB React SDK
 *
 * React hooks and a context provider for **FlexDB** — a high-performance
 * distributed key-value store. Drop the provider in once, then read and
 * mutate data from any component with a single hook call.
 *
 * ## Installation
 *
 * ```ts
 * // deno.json
 * {
 *   "imports": {
 *     "@arctics/flex-db-react": "jsr:@arctics/flex-db-react@^1.0.0"
 *   }
 * }
 * // package.json
 * {
 *   "dependencies": {
 *     "@arctics/flex-db-react": "jsr:@arctics/flex-db-react@^1.0.0"
 *   }
 * }
 * ```
 *
 * ## Setup — wrap your app with `FlexDBProvider`
 *
 * ```tsx
 * // main.tsx
 * import { FlexDBProvider } from "@arctics/flex-db-react";
 *
 * createRoot(document.getElementById("root")!).render(
 *   <FlexDBProvider config={{
 *     apiKey:    import.meta.env.VITE_FLEXDB_KEY,
 *     baseUrl:   "https://eu.flex.arctics.dev",
 *     namespace: "users",
 *   }}>
 *     <App />
 *   </FlexDBProvider>
 * );
 * ```
 *
 * Every FlexDB hook anywhere in the tree will share this one client instance.
 * A `namespace` set here becomes the default for every hook — you can still
 * override it per-hook when needed.
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
 *   const { execute, loading, error } = useCreate();
 *
 *   const handleSubmit = async (form: UserForm) => {
 *     const { key } = await execute({
 *       value:        { name: form.name, age: form.age },
 *       searchParams: { age: form.age, role: form.role },
 *     });
 *     console.log("Saved as:", key);
 *   };
 *
 *   return (
 *     <button onClick={handleSubmit} disabled={loading}>
 *       {loading ? "Saving…" : "Save"}
 *     </button>
 *   );
 * }
 * ```
 *
 * ## Upserting data — `useSet`
 *
 * ```tsx
 * import { useSet } from "@arctics/flex-db-react";
 *
 * function EditUserForm({ userId }: { userId: string }) {
 *   const { execute, loading } = useSet();
 *
 *   return (
 *     <button onClick={() => execute({ key: userId, value: { name: "Alice" } })} disabled={loading}>
 *       {loading ? "Saving…" : "Save"}
 *     </button>
 *   );
 * }
 * ```
 *
 * ## Deleting data — `useDelete`
 *
 * ```tsx
 * import { useDelete } from "@arctics/flex-db-react";
 *
 * function DeleteButton({ itemKey }: { itemKey: string }) {
 *   const { execute, loading } = useDelete();
 *   return (
 *     <button onClick={() => execute({ key: itemKey })} disabled={loading}>
 *       {loading ? "Deleting…" : "Delete"}
 *     </button>
 *   );
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
 * Use `useListHydrated` to receive full objects instead of just IDs
 * (`limit` must be ≤ 20 — server constraint):
 *
 * ```tsx
 * const { data } = useListHydrated<User>({ limit: 20 });
 * data?.map(({ id, data: user }) => <UserCard key={id} user={user} />);
 * ```
 *
 * ## Reactive search — `useSearch` / `useSearchHydrated`
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
 * Every hook exposes an `error` field. You can narrow the type to access
 * HTTP status codes or network details:
 *
 * ```tsx
 * import { FlexDBError, FlexDBNetworkError } from "@arctics/flex-db-react";
 *
 * const { error } = useGet("some-key");
 *
 * if (error instanceof FlexDBError) {
 *   // HTTP error — inspect status code and raw server payload
 *   console.error(error.status, error.body);
 * } else if (error instanceof FlexDBNetworkError) {
 *   // fetch() itself failed — DNS, connection refused, timeout, etc.
 *   console.error(error.cause);
 * }
 * ```
 *
 * ## Escape hatch — direct client access
 *
 * For imperative logic outside the hook pattern, call `useFlexDB()` to obtain
 * the shared {@link FlexDBClient} instance directly:
 *
 * ```tsx
 * import { useFlexDB } from "@arctics/flex-db-react";
 *
 * function MyComponent() {
 *   const client = useFlexDB();
 *
 *   const handleAction = async () => {
 *     const { item } = await client.get<User>("abc123");
 *     console.log(item.name);
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
export type { FlexDBProviderProps } from "./src/context.tsx";

// ── Hooks ──────────────────────────────────────────────────────────────────
export { useHealth } from "./src/hooks/useHealth.tsx";
export { useGet } from "./src/hooks/useGet.tsx";
export { useCreate } from "./src/hooks/useCreate.tsx";
export { useSet } from "./src/hooks/useSet.tsx";
export { useDelete } from "./src/hooks/useDelete.tsx";
export { useList, useListHydrated } from "./src/hooks/useList.tsx";
export { useSearch, useSearchHydrated } from "./src/hooks/useSearch.tsx";

// ── Core client (escape hatch) ─────────────────────────────────────────────
export { FlexDBClient } from "./src/core/client.tsx";

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  // Config
  FlexDBConfig,
  RetryConfig,

  // Data shapes
  SearchParams,
  SearchParamValue,
  FilterOperators,
  Filters,

  // Raw API responses
  CreateResponse,
  SetResponse,
  GetResponse,
  DeleteResponse,
  ListIdsResponse,
  ListItemsResponse,

  // Hook state shapes
  HookState,
  UseGetState,
  UseMutationState,
  PaginatedState,
} from "./src/core/types.tsx";

// ── Hook option types ──────────────────────────────────────────────────────
export type { UseGetOptions } from "./src/hooks/useGet.tsx";
export type { UseCreateOptions, CreateArgs } from "./src/hooks/useCreate.tsx";
export type { UseSetOptions, SetArgs } from "./src/hooks/useSet.tsx";
export type { UseDeleteOptions, DeleteArgs } from "./src/hooks/useDelete.tsx";
export type { UseListOptions, UseListHydratedOptions } from "./src/hooks/useList.tsx";
export type { UseSearchOptions, UseSearchHydratedOptions } from "./src/hooks/useSearch.tsx";

// ── Errors ─────────────────────────────────────────────────────────────────
export { FlexDBError, FlexDBNetworkError } from "./src/core/types.tsx";