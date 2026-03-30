# SolidJS Patterns

Rules and common mistakes for working with SolidJS in this codebase.

## Do

### Use onMount for initial data fetching

```tsx
// GOOD
onMount(() => {
  void fetchData();
});
```

Or use `createAppLoader` which handles this for you:

```tsx
const loader = createAppLoader(() => fetchNui<Item[]>('getItems', {}, []), { initialData: [] });
```

### Use `<For>` with fallback for dynamic lists

```tsx
// GOOD
<For each={items()} fallback={<EmptyState />}>
  {(item) => <ItemRow item={item} />}
</For>
```

### Use `<Show>` with fallback for conditional rendering

```tsx
// GOOD
<Show when={user()} fallback={<LoginPrompt />}>
  {(u) => <Profile user={u()} />}
</Show>
```

### Use components, not plain function calls

```tsx
// GOOD
<ItemRow item={item} />

// BAD -- breaks reactivity
{renderItem(item)}
```

### Wrap window listeners in onMount + onCleanup

```tsx
// GOOD
onMount(() => {
  const handler = (e: KeyboardEvent) => { /* ... */ };
  window.addEventListener('keydown', handler);
  onCleanup(() => window.removeEventListener('keydown', handler));
});

// BETTER -- use the hook
useWindowEvent<KeyboardEvent>('keydown', handler);
```

### Use createSignal for simple values, createAppStore for complex local state

```tsx
// Simple toggle
const [open, setOpen] = createSignal(false);

// Complex state with actions
const [state, actions] = createAppStore(
  { tab: 'all', search: '', selected: null as Item | null },
  (state, setState) => ({
    setTab: (tab: string) => setState('tab', tab),
    setSearch: (q: string) => setState('search', q),
    select: (item: Item | null) => setState('selected', item),
  })
);
```

### Use batch() for multiple signal updates

```tsx
import { batch } from 'solid-js';

// GOOD -- single re-render
batch(() => {
  setLoading(false);
  setData(result);
  setError(null);
});

// BAD -- three re-renders
setLoading(false);
setData(result);
setError(null);
```

---

## Don't

### Don't use createEffect for data fetching without explicit deps

```tsx
// BAD -- runs on every reactive change in scope
createEffect(() => {
  fetchData();
});

// GOOD -- explicit trigger
onMount(() => void fetchData());

// GOOD -- explicit deps via on()
createEffect(on(query, () => void fetchData()));
```

### Don't use .map() for reactive lists

```tsx
// BAD -- entire list re-renders on any change
<div>{items().map(item => <ItemRow item={item} />)}</div>

// GOOD -- only changed items re-render
<For each={items()}>
  {(item) => <ItemRow item={item} />}
</For>
```

### Don't destructure props

SolidJS props are reactive getters. Destructuring breaks reactivity.

```tsx
// BAD -- loses reactivity, values frozen at call time
function MyComponent({ name, count }: Props) {
  return <span>{name}: {count}</span>;
}

// GOOD -- reactive access via props.x
function MyComponent(props: Props) {
  return <span>{props.name}: {props.count}</span>;
}
```

### Don't use React patterns

| React | SolidJS |
|---|---|
| `useState` | `createSignal` |
| `useEffect` | `createEffect` / `onMount` |
| `useCallback` | Not needed (no re-renders) |
| `useMemo` | `createMemo` |
| `useRef` | `let ref: HTMLElement` |
| `React.memo` | Not needed (fine-grained reactivity) |
| `key={id}` on lists | `<For each={...}>` handles it |

### Don't use window.prompt / alert / confirm

These are blocked in FiveM NUI. Use the built-in dialog system:

```tsx
import { uiPrompt } from '@/utils/uiDialog';
import { uiAlert } from '@/utils/uiAlert';
import { uiConfirm } from '@/utils/uiDialog';

// BAD -- blocked in FiveM
const name = window.prompt('Enter name');

// GOOD
const name = await uiPrompt('Enter name', { title: 'New Contact' });

// BAD
window.alert('Saved!');

// GOOD
uiAlert('Saved!');

// BAD
if (window.confirm('Delete?')) { ... }

// GOOD
const yes = await uiConfirm('Delete this item?');
if (yes) { ... }
```

### Don't use backdrop-filter blur

FiveM's NUI (CEF) does not support `backdrop-filter`. Use solid or translucent backgrounds.

```scss
// BAD -- invisible in FiveM
.overlay {
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

// GOOD
.overlay {
  background: rgba(var(--surface-rgb), 0.94);
}
```

### Don't call hooks after conditional returns

SolidJS hooks must be called unconditionally at the top level of a component.

```tsx
// BAD -- hook may not run
function MyApp() {
  if (!ready()) return <Loading />;
  usePhoneKeyHandler({ Enter: handleEnter }); // WRONG
  return <Content />;
}

// GOOD
function MyApp() {
  usePhoneKeyHandler({ Enter: handleEnter });
  return (
    <Show when={ready()} fallback={<Loading />}>
      <Content />
    </Show>
  );
}
```

---

## Summary Table

| Pattern | Do | Don't |
|---|---|---|
| Data fetching | `createAppLoader`, `onMount` | `createEffect(() => fetch())` |
| Lists | `<For each={...}>` | `items().map(...)` |
| Conditionals | `<Show when={...}>` | `{condition && <X/>}` in complex cases |
| Props | `props.name` | `const { name } = props` |
| Multiple updates | `batch(() => { ... })` | Sequential signal sets |
| Window events | `useWindowEvent` | Raw `addEventListener` without cleanup |
| Dialogs | `uiPrompt`, `uiConfirm`, `uiAlert` | `window.prompt/alert/confirm` |
| Backgrounds | `rgba(var(--surface-rgb), 0.94)` | `backdrop-filter: blur()` |
