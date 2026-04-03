# FlexDB React SDK

React hooks and a context provider for **FlexDB** — a high-performance distributed key-value store. Drop the provider in once, then read and mutate data from any component with a single hook call.

## Installation

```jsonc
// deno.json
{
  "imports": {
    "@arctics/flex-db-react": "jsr:@arctics/flex-db-react@^1.0.0",
    "react": "npm:react@^18.0.0"
  }
}
// package.json
```

## Setup

Wrap your application with `FlexDBProvider` once near the root. Every FlexDB hook in the tree shares this single client instance, so your API key, base URL, and retry config are set in one place.

```tsx
// main.tsx
import { FlexDBProvider } from "@arctics/flex-db-react";

const config = {
  apiKey:    import.meta.env.VITE_FLEXDB_KEY,
  baseUrl:   "https://eu.flex.arctics.dev",
  namespace: "users", // optional default namespace for every hook
};

createRoot(document.getElementById("root")!).render(
  <FlexDBProvider config={config}>
    <App />
  </FlexDBProvider>
);
```

> **Tip:** define `config` outside your component (or memoize it with `useMemo`). An unstable reference recreates the internal client on every render.

## Hooks at a glance

| Hook | What it does |
|---|---|
| `useGet` | Fetch one item by key — auto-runs on mount, cancels on unmount |
| `useCreate` | Create a new item with a server-generated key |
| `useSet` | Upsert an item at a caller-supplied key |
| `useDelete` | Permanently remove an item |
| `useList` | Paginated list of item keys with "load more" |
| `useListHydrated` | Paginated list of full item objects (limit ≤ 20) |
| `useSearch` | Reactive filter-based search, re-runs when filters change |
| `useSearchHydrated` | Reactive search returning full objects (limit ≤ 20) |
| `useHealth` | Ping the service — useful for status badges |

---

## Reading data — `useGet`

Fetches a single item by key and keeps your component in sync.

- Auto-fetches on mount and whenever `key` or `namespace` changes.
- Cancels the in-flight request when the component unmounts.
- `data` persists across re-fetches so the UI never flashes to empty.

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
      <p>{data?.name}, {data?.age}</p>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

Pass `null` or `undefined` as the key to skip fetching. Pass `enabled: false` to defer until a condition is met:

```tsx
// Only fetch when a modal is open
const { data } = useGet<User>(userId, { enabled: isModalOpen });
```

---

## Creating data — `useCreate`

Creates a new item with a **server-generated** NanoID key.

```tsx
import { useCreate } from "@arctics/flex-db-react";

function NewUserForm() {
  const { execute, loading, data, error } = useCreate({ namespace: "users" });

  const handleSubmit = async (form: UserForm) => {
    const { key } = await execute({
      value:        { name: form.name, age: form.age },
      searchParams: { age: form.age, role: form.role }, // index for search
    });
    console.log("Saved as:", key);
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

## Upserting data — `useSet`

Upserts (create-or-overwrite) an item at a **caller-supplied** key. The entire stored value is replaced on each call.

```tsx
import { useSet } from "@arctics/flex-db-react";

function EditUserForm({ userId }: { userId: string }) {
  const { execute, loading, error } = useSet({ namespace: "users" });

  return (
    <>
      {error && <p>{error.message}</p>}
      <button
        onClick={() => execute({ key: userId, value: { name: "Alice", age: 31 } })}
        disabled={loading}
      >
        {loading ? "Saving…" : "Save"}
      </button>
    </>
  );
}
```

---

## Deleting data — `useDelete`

Permanently removes an item. Both the data and its search index entries are deleted.

```tsx
import { useDelete } from "@arctics/flex-db-react";

function DeleteButton({ itemKey }: { itemKey: string }) {
  const { execute, loading, error } = useDelete({ namespace: "users" });

  return (
    <>
      {error && <p>{error.message}</p>}
      <button onClick={() => execute({ key: itemKey })} disabled={loading}>
        {loading ? "Deleting…" : "Delete"}
      </button>
    </>
  );
}
```

---

## Listing items — `useList` / `useListHydrated`

Paginated list with a built-in "load more" pattern. `data` accumulates across `fetchMore` calls so infinite scroll works without manual list management.

### `useList` — keys only

```tsx
import { useList } from "@arctics/flex-db-react";

function UserList() {
  const { data, loading, error, hasMore, fetchMore } = useList({
    namespace: "users",
    limit:     20,
  });

  return (
    <>
      <ul>
        {data?.map(id => <li key={id}>{id}</li>)}
      </ul>
      {loading && <Spinner />}
      {error   && <p>{error.message}</p>}
      {hasMore  && <button onClick={fetchMore} disabled={loading}>Load more</button>}
    </>
  );
}
```

### `useListHydrated` — full objects (limit ≤ 20)

```tsx
import { useListHydrated } from "@arctics/flex-db-react";

interface User { name: string; avatarUrl: string; }

function UserCards() {
  const { data, hasMore, fetchMore } = useListHydrated<User>({
    namespace: "users",
    limit:     20,
  });

  return (
    <>
      {data?.map(({ id, data: user }) => (
        <UserCard key={id} user={user} />
      ))}
      {hasMore && <button onClick={fetchMore}>Load more</button>}
    </>
  );
}
```

---

## Searching items — `useSearch` / `useSearchHydrated`

Reactive search that re-runs automatically when filters change.

> **Important:** always wrap your `filters` object with `useMemo`. A new object reference on every render triggers a new search on every render.

### `useSearch` — keys only

```tsx
import { useSearch } from "@arctics/flex-db-react";

function ProductSearch() {
  const [minPrice, setMinPrice] = useState(0);

  // Stabilise — prevents re-fetch on every render
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
        placeholder="Min price"
      />
      <ul>{data?.map(id => <li key={id}>{id}</li>)}</ul>
      {loading && <Spinner />}
      {hasMore  && <button onClick={fetchMore}>Load more</button>}
    </>
  );
}
```

### `useSearchHydrated` — full objects (limit ≤ 20)

```tsx
import { useSearchHydrated } from "@arctics/flex-db-react";

interface Product { title: string; price: number; }

function ProductGrid() {
  const filters = useMemo(() => ({ category: { eq: "books" } }), []);

  const { data, hasMore, fetchMore } = useSearchHydrated<Product>(filters, {
    namespace: "products",
    limit:     12,
  });

  return (
    <>
      {data?.map(({ id, data: product }) => (
        <ProductCard key={id} product={product} />
      ))}
      {hasMore && <button onClick={fetchMore}>Load more</button>}
    </>
  );
}
```

### Filter operators reference

| Operator | Meaning |
|---|---|
| `eq` | Exact match |
| `neq` | Not equal |
| `gt` / `gte` | Greater than / greater than or equal |
| `lt` / `lte` | Less than / less than or equal |
| `inc` | String contains or array includes |
| `sw` | String starts with |
| `ex` | Field exists (`true`) / does not exist (`false`) |

```tsx
const filters = useMemo(() => ({
  price:    { gte: 10, lte: 100 },   // range
  category: { eq: "electronics" },   // exact
  sku:      { sw: "WIDGET-" },        // prefix
  tags:     { inc: "sale" },          // contains
  discount: { ex: true },             // field exists
}), []);
```

---

## Service health — `useHealth`

Pings the FlexDB service. No authentication required — safe to call before a user is signed in.

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

## Error handling

Every hook exposes an `error` field. Import `FlexDBError` and `FlexDBNetworkError` to narrow the type:

```tsx
import { FlexDBError, FlexDBNetworkError } from "@arctics/flex-db-react";

const { error } = useGet("some-key");

if (error instanceof FlexDBError) {
  // Non-2xx response — inspect the HTTP status and raw server payload
  if (error.status === 404) console.error("Not found");
  if (error.status === 401) console.error("Invalid API key");
  console.error(error.body); // raw server payload
} else if (error instanceof FlexDBNetworkError) {
  // fetch() itself failed — DNS, connection refused, timeout, etc.
  console.error("Network error:", error.cause);
}
```

Mutation hooks (`useCreate`, `useSet`, `useDelete`) also **re-throw** from `execute`, so you can handle failures inline with `try/catch`:

```tsx
const { execute } = useCreate({ namespace: "users" });

try {
  const { key } = await execute({ value: formData });
  navigate(`/users/${key}`);
} catch (err) {
  // error is also in the `error` state field
}
```

---

## Retry configuration

By default the SDK retries failed requests up to **3 times** with a **10 ms** delay. Only transient errors are retried — network failures, HTTP `429`, and HTTP `5xx`. Client errors (`4xx`) and aborted requests are thrown immediately.

```tsx
// Aggressive retry
<FlexDBProvider config={{ ..., retry: { times: 5, delay: 50 } }}>

// Disable retries entirely
<FlexDBProvider config={{ ..., retry: false }}>
```

---

## Namespace overrides

The namespace set on `FlexDBProvider` is the default for every hook. Override it per-hook when needed:

```tsx
<FlexDBProvider config={{ ..., namespace: "users" }}>

  {/* Uses the default "users" namespace */}
  <UserList />

  {/* Overrides to "products" for this hook only */}
  <ProductList />  {/* useList({ namespace: "products" }) inside */}

</FlexDBProvider>
```

---

## Escape hatch — direct client access

For imperative logic that doesn't fit the hook pattern, use `useFlexDB()` to obtain the shared `FlexDBClient` instance:

```tsx
import { useFlexDB } from "@arctics/flex-db-react";

function TransferButton({ fromKey, toKey }: { fromKey: string; toKey: string }) {
  const client = useFlexDB();

  const handleTransfer = async () => {
    const { item } = await client.get(fromKey);
    await client.set(toKey, item);
    await client.delete(fromKey);
  };

  return <button onClick={handleTransfer}>Transfer</button>;
}
```

`FlexDBClient` can also be instantiated directly for use outside React (server-side scripts, utilities):

```ts
import { FlexDBClient } from "@arctics/flex-db-react";

const client = new FlexDBClient({
  apiKey:  Deno.env.get("FLEXDB_API_KEY")!,
  baseUrl: "https://eu.flex.arctics.dev",
});

const { key } = await client.create({ name: "Alice" }, "users");
```

---

## License

Apache 2.0 © Arctics Development Studios