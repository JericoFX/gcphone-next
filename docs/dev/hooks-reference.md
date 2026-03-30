# Hooks Reference

All hooks are exported from `web/src/hooks/index.ts`. Import via `@/hooks`.

---

## createAppLoader

Reactive data loader for fetch-on-mount patterns. Wraps `fetchNui` with loading/error/refetch/mutate.

```ts
function createAppLoader<T>(
  fetchFn: () => Promise<T>,
  options?: { initialData: T; autoFetch?: boolean }
): AppLoader<T>;

interface AppLoader<T> {
  data: Accessor<T>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
  refetch: () => Promise<void>;
  mutate: (fn: (prev: T) => T) => void;
}
```

```tsx
const posts = createAppLoader(
  () => fetchNui<Post[]>('getPosts', {}, []),
  { initialData: [] }
);

// Read
posts.data();     // Post[]
posts.loading();  // boolean
posts.error();    // string | null

// Refresh from server
await posts.refetch();

// Optimistic update
posts.mutate(prev => prev.filter(p => p.id !== deletedId));
```

Uses `onMount` internally. Set `autoFetch: false` to fetch manually via `refetch()`.

See [data-fetching.md](./data-fetching.md) for full guide.

---

## createAppStore

Typed local store with actions. Thin wrapper over SolidJS `createStore`.

```ts
function createAppStore<S extends object, A extends Record<string, Function>>(
  initialState: S,
  actionsFactory: (state: S, setState: SetStoreFunction<S>) => A
): [S, A];
```

```tsx
const [state, actions] = createAppStore(
  { tab: 'all', search: '', editing: null as Note | null },
  (state, setState) => ({
    setTab: (tab: string) => setState('tab', tab),
    setSearch: (q: string) => setState('search', q),
    startEdit: (note: Note) => setState('editing', note),
    stopEdit: () => setState('editing', null),
  })
);

// Usage
state.tab;                // 'all'
actions.setTab('starred');
```

See [state-management.md](./state-management.md) for full guide.

---

## useNuiCallback

Subscribe to NUI push events from the game client. Cleans up automatically.

```ts
function useNuiCallback<T>(eventName: string, handler: (data: T) => void): void;
```

```tsx
useNuiCallback<{ id: number }>('contactUpdated', (data) => {
  loader.refetch();
});
```

See [nui-bridge.md](./nui-bridge.md) for the full NUI communication guide.

---

## useAsyncData

Legacy async data hook. Prefer `createAppLoader` for new code. Use this when you need callbacks (`onSuccess`, `onError`) or manual `reset()`.

```ts
function useAsyncData<T>(
  fetchFn: () => Promise<T>,
  options?: {
    initialData?: T;
    autoFetch?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  }
): {
  data: Accessor<T | undefined>;
  loading: Accessor<boolean>;
  error: Accessor<Error | null>;
  execute: () => Promise<T | undefined>;
  reset: () => void;
  setData: Setter<T | undefined>;
};
```

```tsx
const { data, loading, execute, reset } = useAsyncData(
  () => fetchNui<Result>('search', { q: query() }),
  { autoFetch: false, onSuccess: (r) => console.log('Got', r) }
);

// Trigger manually
await execute();

// Reset to initial state
reset();
```

Also exports `useDelayedLoading(delay?)` for artificial loading delays.

---

## useAppCache

In-memory cache with TTL and prefix scoping.

```ts
function useAppCache(prefix: string): {
  get: <T>(key: string) => T | null;
  set: <T>(key: string, value: T, ttlMs?: number) => void;  // Default: 30000ms
  invalidate: (key?: string) => void;  // No key = clear all with prefix
  version: Accessor<number>;  // Increments on any change
};
```

```tsx
const cache = useAppCache('gallery');

// Check cache first
const cached = cache.get<Photo[]>('recent');
if (!cached) {
  const photos = await fetchNui<Photo[]>('getPhotos', {}, []);
  cache.set('recent', photos, 60000); // 60s TTL
}

// Invalidate after mutation
cache.invalidate('recent');

// Clear everything under 'gallery:*'
cache.invalidate();
```

Max 200 entries globally. Expired entries are pruned on insert.

---

## useContextMenu

Manages open/close state for context menus and action sheets.

```ts
function useContextMenu<T>(): {
  item: Accessor<T | null>;          // Currently selected item
  isOpen: () => boolean;
  open: (value: T) => void;
  close: () => void;
  onContextMenu: (value: T) => (e: MouseEvent) => void;  // Event handler factory
};
```

```tsx
const menu = useContextMenu<Contact>();

<For each={contacts()}>
  {(contact) => (
    <button onContextMenu={menu.onContextMenu(contact)} onClick={() => handleTap(contact)}>
      {contact.display}
    </button>
  )}
</For>

<ActionSheet
  open={menu.isOpen()}
  actions={[
    { label: 'Edit', onClick: () => editContact(menu.item()!) },
    { label: 'Delete', tone: 'danger', onClick: () => deleteContact(menu.item()!) },
  ]}
  onClose={menu.close}
/>
```

---

## useListNavigation

Keyboard navigation for lists. Listens to internal `phone:keyUp` events.

```ts
function useListNavigation<T>(
  items: () => T[],
  options?: {
    onSelect?: (item: T, index: number) => void;  // Called on Enter
    onActivate?: (item: T, index: number) => void;
    initialIndex?: number;      // Default: -1
    loop?: boolean;             // Default: false
  }
): {
  selectedIndex: Accessor<number>;
  setSelectedIndex: Setter<number>;
  isActive: Accessor<boolean>;
  setIsActive: Setter<boolean>;
  selectNext: () => void;
  selectPrev: () => void;
  selectFirst: () => void;
  selectLast: () => void;
  confirmSelection: () => void;
  reset: () => void;
  selectedItem: () => T | undefined;
};
```

Key bindings: ArrowUp/Down to navigate, Enter to confirm, Home/End to jump.

```tsx
const nav = useListNavigation(() => filteredItems(), {
  onSelect: (item) => openDetail(item),
  loop: true,
});

<For each={filteredItems()}>
  {(item, i) => (
    <div classList={{ [styles.selected]: nav.selectedIndex() === i() }}>
      {item.name}
    </div>
  )}
</For>
```

---

## useMediaAttachment

Manages media attachment flow (gallery, camera, URL input).

```ts
function useMediaAttachment(options?: {
  onAttached?: (url: string) => void;
  onRemoved?: () => void;
  onError?: (message: string) => void;
}): {
  mediaUrl: Accessor<string | null>;
  mediaType: Accessor<'image' | 'video' | 'audio' | null>;
  attachFromGallery: () => Promise<boolean>;
  attachFromCamera: () => Promise<boolean>;
  attachByUrl: () => Promise<boolean>;
  clearAttachment: () => void;
  setAttachment: (url: string | null) => void;
};
```

```tsx
const media = useMediaAttachment({
  onAttached: (url) => console.log('Attached:', url),
});

<button onClick={media.attachFromCamera}>Take Photo</button>
<button onClick={media.attachByUrl}>Paste URL</button>

<Show when={media.mediaUrl()}>
  <MediaPreview url={media.mediaUrl()!} />
  <button onClick={media.clearAttachment}>Remove</button>
</Show>
```

URLs are sanitized via `sanitizeMediaUrl` before being stored.

---

## useNfcShare

Manages NFC sharing flow with cooldown, rate limiting, and notifications.

```ts
function useNfcShare(options: {
  onShare: (targetServerId: number) => Promise<{ success?: boolean; error?: string }>;
  successMessage?: string;
  errorMessages?: Record<string, string>;
}): {
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
  sharing: () => boolean;
  handleSelect: (targetServerId: number) => Promise<void>;
};
```

```tsx
const nfc = useNfcShare({
  onShare: (targetId) => fetchNui('shareContact', { targetServerId: targetId, contact }),
  successMessage: 'Contact shared',
});

<button onClick={nfc.open}>Share via NFC</button>

<NfcShareSheet
  open={nfc.isOpen()}
  onClose={nfc.close}
  onSelect={nfc.handleSelect}
  disabled={nfc.sharing()}
/>
```

Built-in 10-second cooldown per target. Shows toast notifications on success/error.

---

## usePhoneKeyHandler

General-purpose key handler for phone hardware keys.

```ts
interface PhoneKeyHandlers {
  Backspace?: () => void;
  ArrowUp?: () => void;
  ArrowDown?: () => void;
  ArrowLeft?: () => void;
  ArrowRight?: () => void;
  Enter?: () => void;
  Escape?: () => void;
  [key: string]: (() => void) | undefined;
}

function usePhoneKeyHandler(handlers: PhoneKeyHandlers): void;
```

If `Backspace` is not provided, it defaults to `router.goBack()`.

```tsx
usePhoneKeyHandler({
  Backspace: () => {
    if (isEditing()) { stopEdit(); return; }
    // Falls through to default goBack
  },
  Enter: () => confirmSelection(),
});
```

Also exports `useBackspaceKey(onBack?)` for simple back-button-only handling:

```tsx
useBackspaceKey(() => {
  if (hasUnsaved()) { showConfirm(); return; }
  // Default: goBack()
});
```

---

## usePollingTask

Runs a task on an interval while a condition is true.

```ts
function usePollingTask(
  task: () => void | Promise<void>,
  intervalMs: () => number,
  enabled: () => boolean
): void;
```

```tsx
usePollingTask(
  () => loader.refetch(),
  () => 5000,                    // Every 5 seconds
  () => isVisible()              // Only while visible
);
```

Runs `task()` immediately when enabled, then every `intervalMs`. Cleans up automatically.

---

## useWindowEvent

Safely adds a window event listener with `onMount`/`onCleanup`.

```ts
function useWindowEvent<T extends Event>(
  type: string,
  listener: (event: T) => void,
  options?: boolean | AddEventListenerOptions
): void;
```

```tsx
useWindowEvent<KeyboardEvent>('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

useWindowEvent('resize', () => recalcLayout());
```

---

## useLiveFlashlight

Controls the in-game flashlight (camera app). Manages on/off, color temperature, brightness, and long-press panel.

```ts
function useLiveFlashlight(): {
  supported: Accessor<boolean>;
  enabled: Accessor<boolean>;
  panelOpen: Accessor<boolean>;
  kelvin: Accessor<number>;
  lumens: Accessor<number>;
  kelvinRange: Accessor<{ min: number; max: number }>;
  lumensRange: Accessor<{ min: number; max: number }>;
  setPanelOpen: Setter<boolean>;
  setKelvin: Setter<number>;
  setLumens: Setter<number>;
  loadSettings: () => Promise<void>;
  loadCapabilities: () => Promise<void>;
  saveSettings: (next: { kelvin?: number; lumens?: number }) => Promise<void>;
  toggle: () => Promise<boolean>;
  turnOff: () => Promise<void>;
  applyPreset: (kelvin: number, lumens?: number) => Promise<void>;
  beginPress: () => void;        // Start long-press detection (420ms)
  endPress: () => void;          // End press (short = toggle, long = panel)
  cancelPress: () => void;
};
```

```tsx
const flash = useLiveFlashlight();

<button
  onPointerDown={flash.beginPress}
  onPointerUp={flash.endPress}
  onPointerLeave={flash.cancelPress}
>
  Flashlight {flash.enabled() ? 'ON' : 'OFF'}
</button>
```

Short press toggles on/off. Long press (420ms+) opens the brightness/color panel.
