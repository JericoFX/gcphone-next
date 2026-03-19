---
title: Adding an App
---

# Adding an App

This guide walks through creating a new phone app for gcphone-next. The frontend uses SolidJS with TypeScript, SCSS Modules, and an iOS 18-inspired design system.

## File Structure

Create a folder for your app under `web/src/components/apps/`:

```
web/src/components/apps/YourAppName/
  YourAppNameApp.tsx          # Main component
  YourAppNameApp.module.scss  # Scoped styles
```

## Step 1: Register Lazy Loading in PhoneFrame

Edit `web/src/components/Phone/PhoneFrame.tsx`:

```tsx
import { lazy } from 'solid-js';

const lazyApps = {
  // ... existing apps ...
  yourapp: lazy(() => import('../apps/yourapp/YourAppNameApp')),
};

const APP_DEFINITIONS = {
  // ... existing ...
  yourapp: {
    id: 'yourapp',
    name: 'Your App Name',
    icon: './img/icons_ios/yourapp.svg',
    route: '/app/yourapp',
  },
};
```

## Step 2: Create the Main Component

Use the `AppScaffold` layout component and `usePhoneKeyHandler` for back navigation.

```tsx
// YourAppNameApp.tsx
import { createSignal, createMemo, onMount, For } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { AppScaffold, AppFAB } from '../../shared/layout';
import { usePhoneKeyHandler } from '../../../hooks/usePhoneKeyHandler';
import { t, appName } from '../../../i18n';
import styles from './YourAppNameApp.module.scss';

export function YourAppNameApp() {
  const router = useRouter();

  const [loading, setLoading] = createSignal(false);
  const [data, setData] = createSignal<YourDataType[]>([]);

  // Use createMemo for derived/filtered state
  const filteredData = createMemo(() => {
    const all = data() || [];
    return all.filter(item => item.active);
  });

  // Backspace navigates back
  usePhoneKeyHandler({
    Backspace: () => {
      router.goBack();
    },
  });

  onMount(async () => {
    const response = await fetchNui('getYourAppData', {}, []);
    setData(response);
  });

  return (
    <AppScaffold
      title={appName('yourapp')}
      onBack={() => router.goBack()}
    >
      <div class={styles.container}>
        <For each={filteredData()}>
          {(item) => <div class={styles.item}>{item.name}</div>}
        </For>
      </div>

      {/* Optional: Floating Action Button */}
      <AppFAB
        icon="./img/icons_ios/add.svg"
        onClick={() => {/* action */}}
        tooltip="Add new"
      />
    </AppScaffold>
  );
}
```

## Step 3: Create Scoped Styles

Use SCSS Modules and the existing design system variables. Important rules:

- Use CSS variables from `_ios-system.scss` (`--s-*`, `--r-*`, `--fs-*`)
- **Do not** use `backdrop-filter: blur()` -- FiveM NUI does not support it reliably
- Use `color-mix()` + noise texture for material/glass effects

```scss
// YourAppNameApp.module.scss
.container {
  display: flex;
  flex-direction: column;
  padding: var(--s-4);
  gap: var(--s-3);
}

.item {
  min-height: 48px;
  padding: var(--space-3);
  border-radius: var(--r-lg);
  background: var(--surface);
  border: 1px solid var(--border);

  // Material effect with noise (no blur)
  &.material {
    background: color-mix(in srgb, var(--surface) 84%, transparent);
    background-image: url('/img/noise-texture.png');
    background-repeat: repeat;
    background-blend-mode: overlay;
  }
}
```

## Step 4: Add Custom Hooks (optional)

Extract reusable logic into hooks:

```ts
// web/src/hooks/useYourAppLogic.ts
import { createSignal, createMemo, createEffect } from 'solid-js';

export function useYourAppLogic() {
  const [state, setState] = createSignal<YourState>({ ... });

  const derivedData = createMemo(() => {
    return state().items.filter(...);
  });

  createEffect(() => {
    // Side effect when state changes
  });

  return { state, derivedData, setState };
}
```

## Step 5: Add Global Store (optional)

If the app needs to share state across components:

```tsx
// web/src/store/yourapp.tsx
import { createStore, createContext } from 'solid-js';

interface YourAppState {
  items: YourItemType[];
  selectedId: string | null;
}

const [state, setState] = createStore<YourAppState>({ ... });

export const YourAppContext = createContext<YourAppState>(state);

export function useYourApp() {
  const context = useContext(YourAppContext);
  return context;
}
```

## Step 6: Add the App Icon

Place an SVG icon at:

```
web/src/img/icons_ios/yourapp.svg
```

Reference it in `APP_DEFINITIONS`:

```ts
icon: './img/icons_ios/yourapp.svg',
```

## Step 7: Register on HomeScreen (optional)

If the app should appear on the home screen, add it in `web/src/components/apps/home/HomeScreen.tsx`:

```tsx
const homeApps = createMemo(() => {
  const all = APP_DEFINITIONS;
  return [
    // ... existing ...
    all.yourapp,
  ];
});
```

## Step 8: Add Translations

Add your app name in `web/src/i18n/apps.ts`:

```ts
export const APP_NAMES = {
  // ... existing ...
  yourapp: 'Your App Name',
};
```

## Best Practices

### SolidJS Performance

- Use `createMemo` for computed/derived values
- Use `createSelector` for active selection (tabs, lists)
- Use `batch` for multiple state updates
- Use `onCleanup` to release timers and event listeners

### SCSS / iOS 18 Design System

- Use variables: `--s-*` (spacing), `--r-*` (radii), `--fs-*` (font sizes)
- Do not use `backdrop-filter: blur()`
- Use `color-mix()` + noise texture for material effects
- Always use CSS Modules for local scope

### Shared Components

The codebase provides reusable components:

- **Layout**: `AppScaffold`, `AppFAB`, `AppTabs`
- **UI**: `VirtualList`, `Modal`, `EmptyState`, `SegmentedControl`

### Common Pitfalls

- Do not use `backdrop-filter: blur()` -- it breaks in FiveM NUI
- Do not mix global `ios-*` classes with CSS Modules without clear scoping
- Do not use hardcoded pixel values -- use the design system variables
- Do not recalculate arrays in render without `createMemo`

## Build and Verify

After adding your app, rebuild and type-check:

```bash
cd web
bun run typecheck
bun run build
```

## References

- SolidJS documentation: https://www.solidjs.com
- iOS 18 design system: `web/src/styles/_ios-system.scss`
- SCSS variables: `web/src/styles/_variables.scss`
- Existing hooks: `web/src/hooks/`
- Shared components: `web/src/components/shared/`
