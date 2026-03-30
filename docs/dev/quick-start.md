# Quick Start: Creating a New App

## 1. Copy the Template

```bash
cp -r web/src/components/apps/_template web/src/components/apps/myapp
```

Rename `TemplateApp.tsx` to `MyAppApp.tsx` and update the component name.

## 2. Register in `config/apps.ts`

Add an entry to `APP_DEFINITIONS`:

```ts
// web/src/config/apps.ts

export interface AppDefinition {
  id: string;          // Unique ID used in routing and enabledApps
  name: string;        // Display name
  icon: string;        // Path to icon SVG (./img/icons_ios/<name>.svg)
  route: string;       // Route string — must match the id
  defaultHome?: boolean; // true = home screen, false = app library only
}

export const APP_DEFINITIONS: AppDefinition[] = [
  // ... existing apps ...
  { id: 'myapp', name: 'MyApp', icon: './img/icons_ios/myapp.svg', route: 'myapp', defaultHome: true },
];
```

## 3. Add Lazy Import in `PhoneFrame.tsx`

Add your app to the `lazyApps` object:

```ts
// web/src/components/Phone/PhoneFrame.tsx

const lazyApps = {
  // ... existing entries ...
  myapp: lazy(() =>
    import('../apps/myapp/MyAppApp').then((m) => ({ default: m.MyAppApp })),
  ),
};
```

The router uses this map to render your component when `navigate('myapp')` is called.

## 4. Build the App Component

Use the template pattern with `AppView`, `createAppLoader`, and `createAppStore`:

```tsx
// web/src/components/apps/myapp/MyAppApp.tsx
import { For } from 'solid-js';
import { AppView } from '@/components/shared/layout/AppView';
import { createAppLoader } from '@/hooks/createAppLoader';
import { createAppStore } from '@/hooks/createAppStore';
import { fetchNui } from '@/utils/fetchNui';

interface MyItem {
  id: number;
  title: string;
}

export function MyAppApp() {
  const items = createAppLoader<MyItem[]>(
    () => fetchNui<MyItem[]>('myappGetItems', {}, []),
    { initialData: [] },
  );

  const [state, actions] = createAppStore(
    { search: '' },
    (_state, setState) => ({
      setSearch: (q: string) => setState('search', q),
    }),
  );

  return (
    <AppView<MyItem[]>
      title="My App"
      loader={items}
      emptyTitle="No items"
      emptyDescription="Nothing here yet."
    >
      {() => (
        <For each={items.data()}>
          {(item) => <div>{item.title}</div>}
        </For>
      )}
    </AppView>
  );
}
```

## 5. Add Server Callback

Create `server/modules/myapp.lua`:

```lua
local Bridge = require 'server.bridge'
local Phone = require 'server.modules.phone'

lib.callback.register('gcphone:myappGetItems', function(source)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return {} end

    return MySQL.query.await(
        'SELECT id, title FROM phone_myapp WHERE identifier = ? ORDER BY id DESC',
        { identifier }
    ) or {}
end)
```

## 6. Add NUI Bridge Callback

In `client/nui_bridge.lua`:

```lua
RegisterNUICallback('myappGetItems', function(_, cb)
    lib.callback('gcphone:myappGetItems', false, function(items)
        cb(items or {})
    end)
end)
```

The pattern is always: `RegisterNUICallback` receives the NUI request, calls `lib.callback` to reach the server, and returns the result via `cb()`.

## 7. Build and Test

```bash
cd web && bun run build
```

Open the phone in-game or in browser dev mode (`bun run dev`) and navigate to your app.
