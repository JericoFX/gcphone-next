# App Lifecycle

## Router API

All navigation goes through `useRouter()`, available inside `PhoneFrame`:

```ts
// web/src/components/Phone/PhoneFrame.tsx

interface RouterContextValue {
  currentRoute: () => AppRoute;          // Active route string
  direction: () => 'forward' | 'back';   // Animation direction
  params: () => Record<string, unknown>; // Params passed via navigate()
  navigate: (route: AppRoute, params?: Record<string, unknown>) => void;
  goBack: () => void;
  history: () => AppRoute[];             // Full navigation stack
  openApps: () => AppRoute[];            // All mounted apps (multitasking)
  closeApp: (route: AppRoute) => void;   // Force-close and unmount an app
}
```

Usage:

```tsx
import { useRouter } from '@/components/Phone/PhoneFrame';

function MyComponent() {
  const { navigate, goBack, params } = useRouter();

  // Open another app
  navigate('contacts');

  // Open with params
  navigate('messages', { phoneNumber: '555-0100' });

  // Go back to previous route
  goBack();

  // Read params passed to this app
  const data = params();
}
```

## How Apps Open and Close

1. **`navigate(route, params?)`** pushes `route` onto the history stack. The route is normalized (e.g. `messages.conversation` becomes `messages`). If the app is not already in `openApps`, it gets added.

2. **`goBack()`** pops the last entry from the history stack. The app stays in `openApps` (still mounted) -- it is just not visible.

3. **`closeApp(route)`** removes the app from both `openApps` and `history`, unmounting it. It also fires a `phone:appForceClose` internal event.

## Navigation Direction and Animations

The router tracks `direction()` as either `'forward'` or `'back'`. Each route view gets CSS classes based on whether it is entering or leaving:

| State | CSS class |
|---|---|
| Entering forward | `routeForward` |
| Entering backward | `routeBack` |
| Leaving forward | `routeLeaveForward` |
| Leaving backward | `routeLeaveBack` |

These drive slide animations (350ms transition).

## Multitasking

Apps that have been navigated to remain mounted in `openApps()`. The multitask panel shows the last 5 open apps (excluding home). Users can switch between them or close them.

```tsx
const { openApps, closeApp } = useRouter();

// List all open apps
openApps(); // ['home', 'messages', 'contacts']

// Force close
closeApp('messages');
```

## Passing Params Between Apps

Params are set by `navigate()` and read via `params()`. They persist until the next navigation call.

```tsx
// From app A:
navigate('messages', { phoneNumber: '555-0100', prefill: 'Hello' });

// In app B (messages):
const { params } = useRouter();
const phone = () => params().phoneNumber as string;
```

## Programmatic Navigation (From Outside Components)

Use internal events to open a route from anywhere:

```ts
import { emitInternalEvent } from '@/utils/internalEvents';

emitInternalEvent('phone:openRoute', {
  route: 'messages',
  data: { phoneNumber: '555-0100' },
});
```

## Force Close Event

When `closeApp(route)` is called, a `phone:appForceClose` event is emitted. Apps can listen for this to clean up:

```ts
import { useInternalEvent } from '@/utils/internalEvents';

useInternalEvent<{ route: string }>('phone:appForceClose', (detail) => {
  if (detail.route === 'myapp') {
    // cleanup
  }
});
```

## Enabled Apps

The router only renders apps that are in `phoneState.enabledApps`. If an app's `id` is not in the enabled list, navigating to it shows the home screen instead.

Enabled apps are controlled server-side via feature flags and sent during phone initialization.
