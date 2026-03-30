# Data Fetching

## createAppLoader

The primary data-fetching hook for apps. Wraps a fetch function with reactive `data`, `loading`, `error`, `refetch`, and `mutate`.

```ts
// web/src/hooks/createAppLoader.ts

interface AppLoaderOptions<T> {
  initialData: T;
  autoFetch?: boolean; // default: true
}

interface AppLoader<T> {
  data: Accessor<T>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
  refetch: () => Promise<void>;
  mutate: (fn: (prev: T) => T) => void;
}

function createAppLoader<T>(
  fetchFn: () => Promise<T>,
  options?: AppLoaderOptions<T>
): AppLoader<T>;
```

### Basic Usage

```tsx
const items = createAppLoader<Item[]>(
  () => fetchNui<Item[]>('myappGetItems', {}, []),
  { initialData: [] },
);

// Read data reactively
items.data();       // Item[]
items.loading();    // boolean
items.error();      // string | null

// Re-fetch from server
await items.refetch();
```

### With AppView

`AppView` accepts a `loader` prop and handles loading/error/empty states automatically:

```tsx
<AppView<Item[]>
  title="My App"
  loader={items}
  emptyTitle="No items"
>
  {() => <For each={items.data()}>{(item) => <div>{item.title}</div>}</For>}
</AppView>
```

### Optimistic Updates with mutate()

Update local data without re-fetching:

```tsx
// Add item optimistically
items.mutate((prev) => [...prev, newItem]);

// Update item in place
items.mutate((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));

// Remove item
items.mutate((prev) => prev.filter((i) => i.id !== deletedId));
```

### Disabling Auto-Fetch

```tsx
const items = createAppLoader(fetchFn, { initialData: [], autoFetch: false });

// Fetch manually when ready
items.refetch();
```

## fetchNui

Low-level function to call a NUI callback on the Lua client side.

```ts
// web/src/utils/fetchNui.ts

async function fetchNui<T = unknown>(
  eventName: string,   // NUI callback name (matches RegisterNUICallback)
  data?: unknown,      // Payload sent as { data: ... } in the POST body
  mockData?: T         // Fallback used in browser dev mode
): Promise<T>;
```

### How It Works

1. In browser dev mode (`isEnvBrowser()`), returns `mockData` or tries `handleBrowserNui`.
2. In-game, sends a `POST` to `https://<resourceName>/<eventName>` with:
   - `_gc.token` -- auth token (rotated by server)
   - `_gc.seq` -- incrementing sequence number
   - `_gc.sig` -- FNV-1a hash of `token|seq|eventName`
   - `data` -- the payload
3. Returns the JSON response body, or `mockData` / `null` on error.

### Example

```ts
const contacts = await fetchNui<Contact[]>('getContacts', undefined, []);

const result = await fetchNui<{ success: boolean }>(
  'addContact',
  { display: 'Alice', number: '555-0100' }
);
```

## useAsyncData

An alternative to `createAppLoader` with abort support and callbacks:

```ts
interface UseAsyncDataOptions<T> {
  initialData?: T;
  autoFetch?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

function useAsyncData<T>(
  fetchFn: () => Promise<T>,
  options?: UseAsyncDataOptions<T>
): {
  data: Accessor<T | undefined>;
  loading: Accessor<boolean>;
  error: Accessor<Error | null>;
  execute: () => Promise<T | undefined>;
  reset: () => void;
  setData: Setter<T | undefined>;
};
```

## usePollingTask

Runs a task on an interval while enabled:

```ts
function usePollingTask(
  task: () => void | Promise<void>,
  intervalMs: () => number,
  enabled: () => boolean
): void;
```

Example:

```tsx
usePollingTask(
  () => fetchNui('myappPing', {}),
  () => 5000,      // every 5 seconds
  () => isActive(), // only when active
);
```

## When to Use What

| Hook | Use Case |
|---|---|
| `createAppLoader` | Standard app data fetch with loading/error states. Works with `AppView`. |
| `useAsyncData` | Need abort support, `onSuccess`/`onError` callbacks, or `reset()`. |
| `fetchNui` (raw) | Fire-and-forget mutations (`sendMessage`, `deleteContact`). |
| `usePollingTask` | Periodic refresh (e.g. GPS position, live data). |
