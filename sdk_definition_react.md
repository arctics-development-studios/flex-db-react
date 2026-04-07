# FlexDB React SDK — Definition

**Package:** `@arctics/flex-db-react`  
**Version:** 1.1.2  
**Audience:** Web documentation authors and SDK integrators  
**Purpose:** Complete reference for all hooks, configuration, error types, and behavioural edge cases.

---

## Table of Contents

1. [Installation](#1-installation)
2. [Provider Setup](#2-provider-setup)
3. [Configuration](#3-configuration)
4. [Hooks — Read](#4-hooks--read)
   - [useGet](#useget)
   - [useList](#uselist)
   - [useListHydrated](#uselisthydrated)
   - [useSearch](#usearch)
   - [useSearchHydrated](#usesearchhydrated)
   - [useHealth](#usehealth)
5. [Hooks — Mutate](#5-hooks--mutate)
   - [useCreate](#usecreate)
   - [useSet](#uset)
   - [useDelete](#usedelete)
6. [Direct Client Access](#6-direct-client-access)
7. [Search Filter Operators](#7-search-filter-operators)
8. [Error Reference](#8-error-reference)
9. [Pagination](#9-pagination)
10. [Request Cancellation](#10-request-cancellation)
11. [Retry Behaviour](#11-retry-behaviour)
12. [Namespace Resolution](#12-namespace-resolution)

---

## 1. Installation

### Deno / JSR

```jsonc
// deno.json
{
  "imports": {
    "@arctics/flex-db-react": "jsr:@arctics/flex-db-react@^1.1.0"
  }
}
```

```ts
import { FlexDBProvider, useGet } from "@arctics/flex-db-react";
```

### npm / Node.js

```jsonc
// package.json
{
  "dependencies": {
    "@arctics/flex-db-react": "jsr:@arctics/flex-db-react@^1.1.0"
  }
}
```

### Runtime compatibility

| Runtime | Supported |
|---|---|
| Browser | ✅ |
| Node.js 18+ | ✅ |
| Deno | ✅ |
| Bun | ✅ |
| Cloudflare Workers | ✅ |
| Vercel Edge | ✅ |

The SDK has **zero external dependencies**. It uses the native `fetch`, `AbortController`, and `URLSearchParams` APIs available in all supported runtimes.

---

## 2. Provider Setup

Mount `FlexDBProvider` **once**, near the root of your application. Every FlexDB hook anywhere in the subtree will share the same client instance.

```tsx
// main.tsx
import { FlexDBProvider } from "@arctics/flex-db-react";

const config = {
  apiKey:    import.meta.env.VITE_FLEXDB_KEY,
  baseUrl:   "https://eu.flex.arctics.dev",
  namespace: "users",
};

createRoot(document.getElementById("root")!).render(
  <FlexDBProvider config={config}>
    <App />
  </FlexDBProvider>
);
```

### Config stability

The internal `FlexDBClient` is re-created only when `apiKey`, `baseUrl`, `namespace`, or `retry` changes. An unstable `config` reference (a new object literal on every render) causes the client to be re-created on every render, resetting all hook state in the tree.

```tsx
// ✅ Stable — defined at module scope, never re-created
const config: FlexDBConfig = { ... };
<FlexDBProvider config={config}>

// ✅ Stable — useMemo ensures reference stability
const config = useMemo(() => ({ apiKey, baseUrl }), [apiKey, baseUrl]);
<FlexDBProvider config={config}>

// ❌ Unstable — new object literal on every render
<FlexDBProvider config={{ apiKey: "...", baseUrl: "..." }}>
```

### Multiple providers

Different subtrees can have separate providers with different defaults. Hooks always consume the nearest provider above them in the tree.

```tsx
<FlexDBProvider config={{ ...base, namespace: "users" }}>
  <UserSection />
</FlexDBProvider>

<FlexDBProvider config={{ ...base, namespace: "products" }}>
  <ProductSection />
</FlexDBProvider>
```

---

## 3. Configuration

### `FlexDBConfig`

Passed to `FlexDBProvider` as the `config` prop, or directly to `new FlexDBClient(config)`.

| Field | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | JWT API key. Sent as `Authorization: Bearer <apiKey>` on every request. Never commit this directly — use environment variables. |
| `baseUrl` | `string` | Yes | Base URL of the FlexDB service. Trailing slashes are stripped automatically. Example: `"https://eu.flex.arctics.dev"`. |
| `namespace` | `string` | No | Default namespace (collection) for all hooks in the tree. Can be overridden per-hook via the `namespace` option. Absent means every hook **must** supply its own namespace or an error is thrown. |
| `retry` | `RetryConfig \| false` | No | Retry behaviour for transient failures. Pass `false` to disable retries. Defaults to `{ times: 3, delay: 10 }`. |

### `RetryConfig`

| Field | Type | Default | Description |
|---|---|---|---|
| `times` | `number` | `3` | Maximum number of retry attempts **after** the first failure. `0` disables retries. Clamped to the range `[0, 10]`. |
| `delay` | `number` | `10` | Fixed delay in milliseconds between each retry attempt. |

**Retry candidates:** network failures, HTTP `429`, HTTP `5xx`.  
**Never retried:** HTTP `4xx` (except `429`), `AbortError` (component unmounted or signal fired).

```tsx
// Aggressive retry for production
const config: FlexDBConfig = {
  apiKey:  "...",
  baseUrl: "https://eu.flex.arctics.dev",
  retry:   { times: 5, delay: 50 },
};

// No retries for development / fast feedback
const config: FlexDBConfig = {
  apiKey:  "...",
  baseUrl: "https://eu.flex.arctics.dev",
  retry:   false,
};
```

---

## 4. Hooks — Read

### `useGet`

Fetches a single item by key and keeps the component in sync.

```ts
function useGet<T = unknown>(
  key:      string | null | undefined,
  options?: UseGetOptions,
): UseGetState<T>
```

#### Parameters

| Parameter | Type | Description |
|---|---|---|
| `key` | `string \| null \| undefined` | The item key to fetch. Pass `null` or `undefined` to skip fetching entirely — no request is made until `key` is a non-empty string. |
| `options.namespace` | `string` | Namespace override. Falls back to the provider default. |
| `options.enabled` | `boolean` | When `false`, auto-fetching is disabled — call `refetch()` manually. Defaults to `true`. |

#### Return value — `UseGetState<T>`

| Field | Type | Description |
|---|---|---|
| `data` | `T \| null` | The fetched item, or `null` before the first successful fetch. Persists across re-fetches so the UI does not flash to empty during background refreshes. |
| `loading` | `boolean` | `true` while a request is in-flight. |
| `error` | `FlexDBError \| FlexDBNetworkError \| Error \| null` | The most recent error, or `null` if the last call succeeded. |
| `refetch` | `() => void` | Manually triggers a fresh fetch. Cancels any in-flight request before starting the new one. |

#### Behaviour

- Auto-fetches on mount (unless `enabled: false` or `key` is null/undefined).
- Re-fetches automatically when `key` or `namespace` changes.
- Cancels the in-flight request when the component unmounts.
- When `key` changes rapidly, `loading` never clears incorrectly — a guard ensures the old request's teardown does not overwrite the new request's loading state.

#### Edge cases

| Scenario | Behaviour |
|---|---|
| `key` is `null` or `undefined` | No request is made. `data`, `loading`, and `error` remain at their initial values. |
| `key` changes while a request is in-flight | Old request is aborted. A new request starts immediately. `data` is not cleared — it shows the stale value until the new response arrives. |
| Component unmounts while loading | In-flight request is aborted. State is not updated. |
| Server returns `ERR_NOT_FOUND` (404) | `error` is set to a `FlexDBError` with `status === 404` and `code === "ERR_NOT_FOUND"`. `data` retains its previous value. |
| `enabled` changes from `false` to `true` | A fetch is triggered. |
| `enabled` changes from `true` to `false` | No effect on any in-flight request. Future renders will not auto-fetch. |

```tsx
import { useGet } from "@arctics/flex-db-react";

interface User { name: string; age: number; }

function UserCard({ userId }: { userId: string }) {
  const { data, loading, error, refetch } = useGet<User>(userId, {
    namespace: "users",
  });

  if (loading) return <Spinner />;
  if (error)   return <p>Error: {error.message}</p>;

  return (
    <div>
      <p>{data?.name}</p>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

---

### `useList`

Lists item **keys** in the namespace with cursor-based pagination.

```ts
function useList(options?: UseListOptions): PaginatedState<string>
```

#### Parameters — `UseListOptions`

| Field | Type | Default | Description |
|---|---|---|---|
| `namespace` | `string` | Provider default | Namespace to list items from. |
| `limit` | `number` | `20` | Keys per page. Server accepts 1–100; values above 100 are silently clamped to 100 by the server. |
| `enabled` | `boolean` | `true` | When `false`, the hook will not auto-fetch on mount. Call `fetch()` manually. |

#### Return value — `PaginatedState<string>`

| Field | Type | Description |
|---|---|---|
| `data` | `string[] \| null` | Accumulated list of item keys across all fetched pages. `null` before the first fetch. Never resets on `fetchMore`. |
| `loading` | `boolean` | `true` while a request is in-flight. |
| `error` | `FlexDBError \| FlexDBNetworkError \| Error \| null` | Most recent error, or `null`. |
| `cursor` | `string \| undefined` | Opaque pagination token from the last response. `undefined` before the first fetch or on the last page. Managed internally — you rarely need this directly. |
| `hasMore` | `boolean` | `true` when the server has more pages beyond the current `data`. |
| `fetch` | `() => void` | Fetches page 1 and **replaces** `data`. Called automatically on mount (unless `enabled: false`). |
| `fetchMore` | `() => void` | Fetches the next page and **appends** its keys to `data`. No-op when `hasMore` is `false`. |

#### Behaviour

- Auto-fetches the first page on mount (unless `enabled: false`).
- `fetch()` always resets to page 1 — use it to refresh or apply a new `limit`.
- `fetchMore()` appends to `data` — `data` accumulates across calls.
- Cancels any in-flight request when a new one starts (shared abort controller between `fetch` and `fetchMore`).
- Cancels on unmount.

#### Edge cases

| Scenario | Behaviour |
|---|---|
| `fetchMore()` when `hasMore` is `false` | No-op. No request is made. |
| `fetch()` while `fetchMore()` is in-flight | Previous request is aborted. `data` is replaced with the new first page. |
| `fetchMore()` while `fetch()` is in-flight | Previous request is aborted. Next page is appended when complete. |
| `namespace` or `limit` changes | Effect re-runs, `fetch()` is called, and `data` is replaced with the new first page. |
| Empty namespace | Server returns `keys: []` with no cursor. `data` is `[]`, `hasMore` is `false`. |

```tsx
import { useList } from "@arctics/flex-db-react";

function UserList() {
  const { data, loading, error, hasMore, fetchMore } = useList({
    namespace: "users",
    limit:     20,
  });

  return (
    <>
      <ul>{data?.map(id => <li key={id}>{id}</li>)}</ul>
      {loading && <Spinner />}
      {error   && <p className="error">{error.message}</p>}
      {hasMore  && (
        <button onClick={fetchMore} disabled={loading}>Load more</button>
      )}
    </>
  );
}
```

---

### `useListHydrated`

Lists items and returns their **full data objects**, not just keys.

```ts
function useListHydrated<T = unknown>(
  options?: UseListHydratedOptions,
): PaginatedState<{ key: string; data: T | null }>
```

#### Parameters — `UseListHydratedOptions`

| Field | Type | Default | Description |
|---|---|---|---|
| `namespace` | `string` | Provider default | Namespace to list items from. |
| `limit` | `number` | `20` | Items per page. **Silently clamped to 50** — the server only hydrates full objects when `limit ≤ 50`. |
| `enabled` | `boolean` | `true` | When `false`, auto-fetch is disabled on mount. |

#### Return value — `PaginatedState<{ key: string; data: T | null }>`

Same shape as `useList`, but each element in `data` is `{ key: string; data: T | null }` instead of a bare string.

| Item field | Type | Description |
|---|---|---|
| `key` | `string` | The item's unique key. |
| `data` | `T \| null` | The item's full stored value. `null` if the item existed in the index but could not be retrieved from storage (e.g. concurrently deleted between listing and hydration). |

#### Edge cases

| Scenario | Behaviour |
|---|---|
| `limit` > 50 | Silently clamped to 50 by the SDK before the request is made. The server also silently ignores `?full=true` when `limit > 50`. |
| Item deleted between listing and hydration | Server returns `{ key, data: null }`. The item still appears in `data` with `data: null`. |

```tsx
import { useListHydrated } from "@arctics/flex-db-react";

interface User { name: string; avatarUrl: string; }

function UserCards() {
  const { data, loading, hasMore, fetchMore } = useListHydrated<User>({
    namespace: "users",
    limit:     20,
  });

  return (
    <>
      <div className="grid">
        {data?.map(({ key, data: user }) =>
          user
            ? <UserCard key={key} user={user} />
            : <DeletedPlaceholder key={key} />
        )}
      </div>
      {loading && <Spinner />}
      {hasMore  && <button onClick={fetchMore}>Load more</button>}
    </>
  );
}
```

---

### `useSearch`

Searches indexed items by filter predicates and returns their **keys**.

```ts
function useSearch(
  filters:  Filters,
  options?: UseSearchOptions,
): PaginatedState<string>
```

#### Parameters

| Parameter | Type | Description |
|---|---|---|
| `filters` | `Filters` | Filter predicates evaluated server-side. See [Section 7](#7-search-filter-operators). Watched by **reference equality** — stabilise with `useMemo`. |
| `options.namespace` | `string` | Namespace override. Falls back to the provider default. |
| `options.limit` | `number` | Keys per page. Max 100. Defaults to 20. |
| `options.enabled` | `boolean` | When `false`, the hook will not auto-run on mount or when `filters` changes. Defaults to `true`. |

#### Return value

Same `PaginatedState<string>` shape as `useList`. See [useList return value](#return-value--paginatedstatestring).

#### Behaviour

- **Reactive** — re-runs automatically when the `filters` reference changes.
- `fetch()` always resets to page 1. `fetchMore()` appends the next page.
- Cancels the in-flight request when a new one starts or on unmount.

#### Stabilising filters

The hook compares the `filters` argument using **reference equality**. A new object on every render triggers a new search on every render.

```tsx
// ✅ Stable — only re-runs when minPrice changes
const filters = useMemo(() => ({ price: { gte: minPrice } }), [minPrice]);

// ❌ Unstable — new object on every render = search on every render
const filters = { price: { gte: minPrice } };
```

#### Edge cases

| Scenario | Behaviour |
|---|---|
| `filters` is `{}` (empty object) | Server returns an empty result array. This is a data-leak protection measure — unfiltered scans are not permitted via search. |
| `filters` changes while a request is in-flight | Old request is aborted. New request starts with fresh filters from page 1. `data` is replaced with the new first page. |
| `enabled` is `false` | Hook does not auto-run. Call `fetch()` manually to trigger the first search. |
| All filter operators are unrecognised | Server returns an empty array. |

```tsx
import { useSearch } from "@arctics/flex-db-react";

function ProductSearch() {
  const [minPrice, setMinPrice] = useState(0);

  const filters = useMemo(() => ({
    price:    { gte: minPrice },
    category: { eq: "electronics" },
  }), [minPrice]);

  const { data, loading, hasMore, fetchMore } = useSearch(filters, {
    namespace: "products",
    limit:     20,
  });

  return (
    <>
      <input
        type="number"
        value={minPrice}
        onChange={e => setMinPrice(Number(e.target.value))}
      />
      <ul>{data?.map(id => <li key={id}>{id}</li>)}</ul>
      {loading && <Spinner />}
      {hasMore  && <button onClick={fetchMore}>Load more</button>}
    </>
  );
}
```

---

### `useSearchHydrated`

Searches indexed items by filter predicates and returns their **full data objects**.

```ts
function useSearchHydrated<T = unknown>(
  filters:  Filters,
  options?: UseSearchHydratedOptions,
): PaginatedState<{ key: string; data: T | null }>
```

#### Parameters — `UseSearchHydratedOptions`

| Field | Type | Default | Description |
|---|---|---|---|
| `namespace` | `string` | Provider default | Namespace to search within. |
| `limit` | `number` | `20` | Items per page. **Silently clamped to 50**. |
| `enabled` | `boolean` | `true` | When `false`, auto-run is disabled. |

#### Return value

Same `PaginatedState<{ key: string; data: T | null }>` shape as `useListHydrated`. All reactive and cancellation behaviour from `useSearch` applies.

```tsx
import { useSearchHydrated } from "@arctics/flex-db-react";

interface Product { title: string; price: number; }

function ProductGrid() {
  const [category, setCategory] = useState("all");

  const filters = useMemo(() => (
    category === "all" ? {} : { category: { eq: category } }
  ), [category]);

  const { data, loading, hasMore, fetchMore } = useSearchHydrated<Product>(filters, {
    namespace: "products",
    limit:     12,
  });

  return (
    <>
      <select value={category} onChange={e => setCategory(e.target.value)}>
        <option value="all">All</option>
        <option value="electronics">Electronics</option>
      </select>
      <div className="grid">
        {data?.map(({ key, data: product }) =>
          product
            ? <ProductCard key={key} product={product} />
            : <DeletedPlaceholder key={key} />
        )}
      </div>
      {loading && <Spinner />}
      {hasMore  && <button onClick={fetchMore}>Load more</button>}
    </>
  );
}
```

---

### `useHealth`

Pings the FlexDB service and tracks its liveness in component state.

```ts
function useHealth(): UseHealthState
```

#### Return value — `UseHealthState`

| Field | Type | Description |
|---|---|---|
| `data` | `{ status: string } \| null` | `{ status: "ok" }` when the service is healthy. `null` before the first successful ping. |
| `loading` | `boolean` | `true` while the ping is in-flight. |
| `error` | `FlexDBError \| FlexDBNetworkError \| Error \| null` | Set when the service is unreachable or returns an error. |
| `refetch` | `() => void` | Manually re-pings the service. Cancels any in-flight ping before starting a new one. |

#### Behaviour

- Auto-pings once on mount.
- No authentication required — safe to call before the user is authenticated.
- Cancels any in-flight ping on unmount.
- `refetch()` can be called repeatedly for polling; each call cancels the previous one.

```tsx
import { useHealth } from "@arctics/flex-db-react";

function StatusBadge() {
  const { data, loading, error, refetch } = useHealth();

  if (loading) return <span>Checking…</span>;
  if (error)   return <span style={{ color: "red" }}>⚠ Offline</span>;
  return <span style={{ color: "green" }}>✓ {data?.status}</span>;
}
```

---

## 5. Hooks — Mutate

Mutation hooks (`useCreate`, `useSet`, `useDelete`) share a common pattern:

- They return an `execute` function you call in response to user actions.
- `execute` is memoised with `useCallback` — stable across renders, safe to pass as props or use as effect dependencies.
- `execute` returns a `Promise` of the result **and** updates the hook's state.
- On failure, `execute` sets `error` state **and** re-throws — wrap in `try/catch` to handle failures inline.
- `reset()` clears `data`, `error`, and `loading` back to the initial idle state.

---

### `useCreate`

Creates a new item with a **server-generated** NanoID key.

```ts
function useCreate(options?: UseCreateOptions): UseMutationState<CreateArgs, CreateResponse>
```

#### Options — `UseCreateOptions`

| Field | Type | Description |
|---|---|---|
| `namespace` | `string` | Namespace override. Falls back to the provider default. |

#### `execute` arguments — `CreateArgs`

| Field | Type | Required | Description |
|---|---|---|---|
| `value` | `unknown` | Yes | Any JSON-serialisable value to store. |
| `searchParams` | `SearchParams` | No | Key-value pairs to index for future `useSearch` / `useSearchHydrated` queries. Only the fields listed here are queryable. |

#### Return value — `UseMutationState<CreateArgs, CreateResponse>`

| Field | Type | Description |
|---|---|---|
| `execute` | `(args: CreateArgs) => Promise<CreateResponse>` | Triggers the create. Returns `{ v, ok, key }` on success. |
| `data` | `CreateResponse \| null` | Result of the last successful `execute`. `data.key` is the server-generated key. |
| `loading` | `boolean` | `true` while the request is in-flight. |
| `error` | `FlexDBError \| FlexDBNetworkError \| Error \| null` | Most recent error, or `null`. |
| `reset` | `() => void` | Clears `data`, `error`, and `loading`. |

#### Edge cases

| Scenario | Behaviour |
|---|---|
| `execute` called while another `execute` is in-flight | Both requests proceed in parallel. State reflects whichever resolves last. Avoid calling `execute` concurrently — await the first call if ordering matters. |
| Server returns `ERR_STORE_FAILED` | `execute` throws a `FlexDBError`. `error` is set. `data` retains its previous value. |
| `searchParams` not provided | Item is stored without any indexed metadata. It will not appear in any `useSearch` results. |

```tsx
import { useCreate } from "@arctics/flex-db-react";

function CreateUserForm() {
  const { execute, loading, data, error } = useCreate({ namespace: "users" });

  const handleSubmit = async (formData: UserForm) => {
    const result = await execute({
      value:        { name: formData.name, age: formData.age },
      searchParams: { age: formData.age, role: formData.role },
    });
    console.log("Created with key:", result.key);
  };

  return (
    <>
      {error && <p className="error">{error.message}</p>}
      {data  && <p>Saved! Key: {data.key}</p>}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving…" : "Save"}
      </button>
    </>
  );
}
```

---

### `useSet`

Upserts an item at a **caller-supplied** key. Creates the item if the key does not exist; replaces it entirely if it does.

```ts
function useSet(options?: UseSetOptions): UseMutationState<SetArgs, SetResponse>
```

#### Options — `UseSetOptions`

| Field | Type | Description |
|---|---|---|
| `namespace` | `string` | Namespace override. Falls back to the provider default. |

#### `execute` arguments — `SetArgs`

| Field | Type | Required | Description |
|---|---|---|---|
| `key` | `string` | Yes | The key to store the item under. Any non-empty string is valid. |
| `value` | `unknown` | Yes | Any JSON-serialisable value. Fully replaces the previously stored value — this is not a partial patch. |
| `searchParams` | `SearchParams` | No | Fully replaces the previously stored metadata for this key. Pass `{}` to clear all indexed fields. |

#### Return value — `UseMutationState<SetArgs, SetResponse>`

| Field | Type | Description |
|---|---|---|
| `execute` | `(args: SetArgs) => Promise<SetResponse>` | Triggers the upsert. Returns `{ v, ok, key }` on success. |
| `data` | `SetResponse \| null` | Result of the last successful `execute`. `data.key` echoes the caller-supplied key. |
| `loading` | `boolean` | `true` while the request is in-flight. |
| `error` | `FlexDBError \| FlexDBNetworkError \| Error \| null` | Most recent error, or `null`. |
| `reset` | `() => void` | Clears `data`, `error`, and `loading`. |

#### Edge cases

| Scenario | Behaviour |
|---|---|
| Key does not exist | Item is created (upsert behaviour — same as `useCreate` but with a caller-supplied key). |
| Key already exists | Stored value is **replaced entirely**. Previous `searchParams` are also fully replaced. |
| `searchParams` not provided on update | Previously stored metadata is retained on the server — `searchParams` is only replaced when you explicitly pass it. |

```tsx
import { useSet } from "@arctics/flex-db-react";

function EditUserForm({ userId }: { userId: string }) {
  const { execute, loading, error } = useSet({ namespace: "users" });

  const handleSave = (formData: UserForm) =>
    execute({
      key:          userId,
      value:        { name: formData.name, age: formData.age },
      searchParams: { age: formData.age, role: formData.role },
    });

  return (
    <>
      {error && <p className="error">{error.message}</p>}
      <button onClick={() => handleSave(...)} disabled={loading}>
        {loading ? "Saving…" : "Save"}
      </button>
    </>
  );
}
```

---

### `useDelete`

Permanently removes an item and all its search index entries.

```ts
function useDelete(options?: UseDeleteOptions): UseMutationState<DeleteArgs, DeleteResponse>
```

#### Options — `UseDeleteOptions`

| Field | Type | Description |
|---|---|---|
| `namespace` | `string` | Namespace override. Falls back to the provider default. |

#### `execute` arguments — `DeleteArgs`

| Field | Type | Required | Description |
|---|---|---|---|
| `key` | `string` | Yes | The key of the item to permanently remove. |

#### Return value — `UseMutationState<DeleteArgs, DeleteResponse>`

| Field | Type | Description |
|---|---|---|
| `execute` | `(args: DeleteArgs) => Promise<DeleteResponse>` | Triggers the deletion. Returns `{ v, ok }` on success. |
| `data` | `DeleteResponse \| null` | Result of the last successful `execute`. |
| `loading` | `boolean` | `true` while the request is in-flight. |
| `error` | `FlexDBError \| FlexDBNetworkError \| Error \| null` | Most recent error, or `null`. |
| `reset` | `() => void` | Clears `data`, `error`, and `loading`. |

#### Edge cases

| Scenario | Behaviour |
|---|---|
| Key does not exist | Server returns `ERR_NOT_FOUND`. `execute` throws a `FlexDBError` with `status === 404`. |
| Deletion is permanent | Both the item data and all metadata entries are deleted across all storage tiers. There is no soft-delete or recycle bin. |

```tsx
import { useDelete } from "@arctics/flex-db-react";

function DeleteButton({ itemKey }: { itemKey: string }) {
  const { execute, loading, error } = useDelete({ namespace: "users" });

  const handleDelete = () => {
    if (!confirm("Permanently delete this item?")) return;
    execute({ key: itemKey });
  };

  return (
    <>
      {error && <p>{error.message}</p>}
      <button onClick={handleDelete} disabled={loading}>
        {loading ? "Deleting…" : "Delete"}
      </button>
    </>
  );
}
```

---

## 6. Direct Client Access

### `useFlexDB`

Returns the shared `FlexDBClient` instance from context. Must be called inside a `FlexDBProvider`.

```ts
function useFlexDB(): FlexDBClient
```

Use this when you need **imperative** access — for example, chaining multiple operations in a single event handler. For most cases, prefer the purpose-built hooks.

```tsx
import { useFlexDB } from "@arctics/flex-db-react";

function TransferButton({ fromKey, toKey }: { fromKey: string; toKey: string }) {
  const client = useFlexDB();

  const handleTransfer = async () => {
    const { data } = await client.get(fromKey, "vault");
    await client.set(toKey, data, "vault");
    await client.delete(fromKey, "vault");
  };

  return <button onClick={handleTransfer}>Transfer</button>;
}
```

Throws `Error` if called outside a provider:

> `[FlexDB] useFlexDB must be called inside <FlexDBProvider>. Wrap your app (or subtree) with <FlexDBProvider config={...}>.`

---

### `FlexDBClient`

The underlying HTTP client. Created automatically by `FlexDBProvider`. Can also be instantiated directly for server-side or utility use — it has no React dependency.

```ts
const client = new FlexDBClient(config: FlexDBConfig)
```

Throws `Error` at construction time if `apiKey` or `baseUrl` is missing.

#### Methods

| Method | API endpoint | Description |
|---|---|---|
| `health(signal?)` | `GET /health` | Ping the service. No auth required. |
| `create(value, namespace?, searchParams?, signal?)` | `POST /v1` | Create item with server-generated key. Returns `{ key }`. |
| `get<T>(key, namespace?, signal?)` | `GET /v1/:key` | Fetch single item. Returns `{ data: T }`. |
| `set(key, value, namespace?, searchParams?, signal?)` | `PUT /v1/:key` | Upsert item at caller-supplied key. Returns `{ key }`. |
| `delete(key, namespace?, signal?)` | `DELETE /v1/:key` | Permanently remove item. Returns `{ ok: true }`. |
| `list(opts)` | `GET /v1/list` | Paginated list. Non-hydrated or hydrated — see overloads. |
| `search(opts)` | `POST /v1/search` | Filtered search. Non-hydrated or hydrated — see overloads. |

#### `list` and `search` overloads

Both methods have two overloads based on the `hydrate` flag:

```ts
// Non-hydrated — returns keys only
client.list({ namespace: "users", limit: 50 })
// → Promise<{ keys: string[], count: number, cursor?: string }>

// Hydrated — returns full objects (limit must be ≤ 50)
client.list<User>({ namespace: "users", limit: 20, hydrate: true })
// → Promise<{ items: { key: string; data: User | null }[], count: number, cursor?: string }>
```

---

## 7. Search Filter Operators

Used in `useSearch`, `useSearchHydrated`, and `client.search()`. Filter fields correspond to keys in the `searchParams` / `metadata` object stored when the item was created or updated.

All filters in a single request are **AND-ed** together. There is no OR support.

| Operator | Value type | Description |
|---|---|---|
| `eq` | `string \| number \| boolean \| null` | Exact equality — `field = value`. |
| `neq` | `string \| number \| boolean \| null` | Not equal — `field <> value`. |
| `gt` | `number \| string` | Greater than — `field > value`. Lexicographic for strings. |
| `gte` | `number \| string` | Greater than or equal — `field >= value`. |
| `lt` | `number \| string` | Less than — `field < value`. |
| `lte` | `number \| string` | Less than or equal — `field <= value`. |
| `inc` | `string` | Contains — checks that a string field contains the substring, or an array/set field includes the element. |
| `sw` | `string` | Starts with — checks that a string field begins with the given prefix. |
| `ex` | `boolean` | Attribute existence — `true` means the field must exist; `false` means it must not exist. |

Multiple operators on a single field express a range query:

```ts
const filters: Filters = {
  price:    { gte: 10, lte: 100 },    // range
  category: { eq: "books" },          // exact match
  inStock:  { eq: true },             // boolean
  tags:     { inc: "sale" },          // array contains
  sku:      { sw: "BOOK-" },          // starts with
  discount: { ex: true },             // field must exist
  archived: { ex: false },            // field must not exist
};
```

#### Edge cases

| Scenario | Behaviour |
|---|---|
| Item has no `searchParams` | Has an empty metadata map — will not match any filter. |
| Filter references a field not in `searchParams` | No items match that field — treated as if no item has the field. |
| Comparing a string field with a number value | No matches, not an error. Filter values must match the stored type. |
| Nested field names (e.g. `"user.name"`) | Not supported. Only top-level keys of `searchParams` are indexed. |
| `filters: {}` (empty object) | Server returns an empty array as a data-leak protection measure. Unfiltered scans via search are not permitted. |
| All operators in the filter map are unrecognised | Server returns an empty array. |

---

## 8. Error Reference

### `FlexDBError`

Thrown when the server responds with a non-2xx HTTP status.

```ts
class FlexDBError extends Error {
  readonly status: number;       // HTTP status code (401, 403, 404, 429, 500 …)
  readonly code:   string;       // Stable ERR_* constant — branch on this
  readonly hint:   string | undefined; // Actionable suggestion from the server
  readonly body:   unknown;      // Raw server response body
}
```

`code` is a stable string constant that never changes across server versions. Branch on `code`, not on `message`.

```tsx
import { FlexDBError } from "@arctics/flex-db-react";

const { error } = useGet("some-key");

if (error instanceof FlexDBError) {
  switch (error.code) {
    case "ERR_NOT_FOUND":
      return <p>Item does not exist.</p>;
    case "ERR_UNAUTHORIZED":
      return <p>Session expired — please log in again.</p>;
    case "ERR_RATE_LIMIT_SECOND":
    case "ERR_RATE_LIMIT_MONTH":
      return <p>Too many requests. {error.hint}</p>;
    default:
      return <p>Error: {error.message}</p>;
  }
}
```

### `FlexDBNetworkError`

Thrown when `fetch` itself fails before a response is received — for example, due to a DNS failure, connection refused, or network timeout.

```ts
class FlexDBNetworkError extends Error {
  readonly cause: unknown; // Original error from fetch
}
```

```ts
import { FlexDBError, FlexDBNetworkError } from "@arctics/flex-db-react";

if (error instanceof FlexDBNetworkError) {
  // User-visible: "Could not reach the server. Check your connection."
  console.error(error.message); // "Network request failed: Failed to fetch"
  console.error(error.cause);   // Original fetch error
} else if (error instanceof FlexDBError) {
  console.error(`[${error.code}] ${error.message}`);
  if (error.hint) console.info(`Hint: ${error.hint}`);
}
```

### Server error codes

| Code | HTTP Status | When it occurs |
|---|---|---|
| `ERR_MISSING_AUTH` | 401 | `Authorization` header is absent or malformed. |
| `ERR_MISSING_NAMESPACE` | 401 | `X-Namespace` header is absent. Occurs when no namespace is set on the provider or the hook. |
| `ERR_UNAUTHORIZED` | 401 | JWT is invalid, expired, algorithm is not RS256, issuer is wrong, or token record not found. |
| `ERR_PERMISSION_DENIED` | 403 | Token is valid but lacks the required permission for the operation. |
| `ERR_FORBIDDEN` | 403 | Caller's IP address is not in the database's whitelist. |
| `ERR_NOT_FOUND` | 404 | No item exists with the given key in the given namespace. |
| `ERR_MISSING_FILTER` | 400 | `POST /v1/search` body is absent or missing the `filters` field. |
| `ERR_RATE_LIMIT_SECOND` | 429 | Per-second request rate exceeded. Retried automatically by the SDK. |
| `ERR_RATE_LIMIT_MONTH` | 429 | Monthly request quota exhausted. Retried automatically by the SDK. |
| `ERR_REQUEST_TOO_LARGE` | 429 | Payload exceeds the allowed size limit for the storage tier. |
| `ERR_STORE_FAILED` | 500 | Storage write failed (size limit exceeded, infrastructure error, or missing `data` field). Retried automatically. |
| `ERR_DELETE_FAILED` | 500 | Metadata deletion failed (infrastructure error). Retried automatically. |
| `ERR_INTERNAL` | 500 | Unexpected server error. Retried automatically. |
| `ERR_UNKNOWN` | — | Server did not include an error code in the response. SDK fallback value. |

### SDK-side errors

| Error | When it occurs |
|---|---|
| `Error("[FlexDB] apiKey is required.")` | `new FlexDBClient(config)` called without `apiKey`. |
| `Error("[FlexDB] baseUrl is required.")` | `new FlexDBClient(config)` called without `baseUrl`. |
| `Error("[FlexDB] No namespace…")` | A hook or client method was called but no namespace is set on the provider and none was supplied to the hook. |
| `Error("[FlexDB] useFlexDB must be called inside <FlexDBProvider>…")` | `useFlexDB()` called outside a provider. |

---

## 9. Pagination

All list and search hooks (`useList`, `useListHydrated`, `useSearch`, `useSearchHydrated`) use **cursor-based pagination**.

### Concept

- The server returns an opaque `cursor` string alongside each page of results.
- Passing the cursor back on the next request fetches the next page.
- When `cursor` is absent in the response, the caller is on the last page.
- Cursors are **not stable** across object deletions. If an item is deleted between pages, it simply does not appear — no error is returned.

### Hook pagination API

| Action | How |
|---|---|
| First page | Handled automatically on mount. Call `fetch()` to reset. |
| Next page | Call `fetchMore()`. Data is **appended** to `data`. |
| Check if more pages exist | Read `hasMore`. |
| Reset to first page | Call `fetch()`. `data` is **replaced**. |

### Constraints

| Parameter | Minimum | Maximum | Default | Behaviour when exceeded |
|---|---|---|---|---|
| `limit` (non-hydrated) | 1 | 100 | 20 | Server silently clamps to 100. |
| `limit` (hydrated) | 1 | 50 | 20 | SDK silently clamps to 50 before sending. Server also silently ignores `?full=true` when `limit > 50`. |

### Do not mix cursors across operations

A cursor returned by a `list` request must not be used with a `search` request (or vice versa). This produces undefined behaviour on the server.

---

## 10. Request Cancellation

All hooks use the native `AbortController` API to manage in-flight requests.

### When requests are cancelled

| Event | Hooks affected | Behaviour |
|---|---|---|
| Component unmounts | All hooks | In-flight request is aborted. No state update occurs. |
| `fetch()` called while a request is in-flight | `useList`, `useListHydrated`, `useSearch`, `useSearchHydrated` | Previous request is aborted. New request starts. |
| `fetchMore()` called while a request is in-flight | Same | Previous request is aborted. New page request starts. |
| `refetch()` called while a request is in-flight | `useGet`, `useHealth` | Previous request is aborted. New request starts. |
| `key` or `namespace` changes | `useGet` | Previous request is aborted. New request starts for the new key/namespace. |
| `filters`, `namespace`, or `limit` changes | `useSearch`, `useSearchHydrated` | Previous request is aborted. New request starts. |

### Loading state during cancellation

When a request is aborted and a new one immediately starts, the `loading` flag never flickers to `false` between them. A guard (`!signal.aborted`) in the `finally` block of each hook ensures the outgoing request does not clear `loading` while the incoming one is still pending.

### Cancelled requests are not errors

`AbortError` is silently swallowed in all hooks. It does not set `error` state and is never retried.

---

## 11. Retry Behaviour

Retry logic is implemented in the transport layer and applies to all hooks and direct client calls.

### What is retried

| Scenario | Retried? |
|---|---|
| Network failure (DNS, connection refused, timeout) | ✅ |
| HTTP 429 (rate limit — per-second or monthly) | ✅ |
| HTTP 5xx (server error) | ✅ |
| HTTP 4xx except 429 (client error) | ❌ |
| `AbortError` (component unmounted or signal fired) | ❌ |

### Algorithm

1. Make the first attempt.
2. On a retryable failure, wait `delay` ms (fixed delay — no exponential back-off).
3. Make the next attempt.
4. Repeat up to `retry.times` additional times after the first failure.
5. If all attempts fail, throw the last error.

The `times` value is clamped to `[0, 10]`. The maximum total attempts for any single request is `1 + 10 = 11`.

### Default configuration

```ts
{ times: 3, delay: 10 }
// → up to 4 total attempts (1 initial + 3 retries), 10 ms apart
```

### Disabling retries

```tsx
<FlexDBProvider config={{ ..., retry: false }}>
```

When `retry: false`, every request is a single attempt with no retries.

---

## 12. Namespace Resolution

Every request (except `/health`) requires a namespace, sent as the `X-Namespace` header.

### Resolution order

1. The `namespace` option on the individual hook (highest priority).
2. The `namespace` field on the `FlexDBConfig` passed to `FlexDBProvider` (provider default).
3. If neither is set, the SDK throws synchronously before making any request:

   > `[FlexDB] No namespace. Set one on FlexDBProvider or pass namespace to the hook.`

### Per-hook override

```tsx
// Provider default: "users"
<FlexDBProvider config={{ ..., namespace: "users" }}>

  {/* Uses "users" from the provider */}
  <UserList />

  {/* Overrides to "admins" for this hook only */}
  <AdminList /> {/* uses useList({ namespace: "admins" }) */}

</FlexDBProvider>
```

### No default — every hook supplies its own

```tsx
// No namespace on the provider
<FlexDBProvider config={{ apiKey: "...", baseUrl: "..." }}>

  {/* Every hook must supply its own namespace */}
  const { data } = useGet(id, { namespace: "users" });     // ✅
  const { data } = useList({ namespace: "products" });     // ✅
  const { data } = useGet(id);                             // ❌ throws
</FlexDBProvider>
```
