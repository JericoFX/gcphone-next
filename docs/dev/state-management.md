# State Management

## Local State: createAppStore

Thin wrapper over SolidJS `createStore` with type-inferred actions:

```ts
// web/src/hooks/createAppStore.ts

function createAppStore<S extends object, A extends Record<string, (...args: any[]) => any>>(
  initialState: S,
  actionsFactory: (state: S, setState: SetStoreFunction<S>) => A
): [S, A];
```

### Example

```tsx
const [state, actions] = createAppStore(
  {
    tab: 'all' as 'all' | 'favorites',
    selectedId: null as number | null,
    showCreate: false,
    newTitle: '',
  },
  (_state, setState) => ({
    setTab: (tab: string) => setState('tab', tab),
    select: (id: number) => setState('selectedId', id),
    clearSelection: () => setState('selectedId', null),
    openCreate: () => setState('showCreate', true),
    closeCreate: () => {
      setState('showCreate', false);
      setState('newTitle', '');
    },
    setNewTitle: (v: string) => setState('newTitle', v),
  }),
);

// Read
state.tab;         // 'all'
state.selectedId;  // null

// Mutate
actions.setTab('favorites');
actions.select(42);
```

## Global Stores

Global stores are provided via SolidJS Context at the app root. Import the hook to access state and actions.

### usePhone()

```ts
import { usePhone } from '@/store/phone';
const [phoneState, phoneActions] = usePhone();
```

**PhoneState** (key fields):

| Field | Type | Description |
|---|---|---|
| `visible` | `boolean` | Phone is shown |
| `locked` | `boolean` | Phone is locked |
| `requiresSetup` | `boolean` | First-boot setup pending |
| `framework` | `'esx' \| 'qbcore' \| 'qbox' \| 'unknown'` | Detected framework |
| `settings.phoneNumber` | `string` | Player's phone number |
| `settings.wallpaper` | `string` | Wallpaper URL |
| `settings.theme` | `'auto' \| 'light' \| 'dark'` | Theme |
| `settings.language` | `AppLanguage` | UI language |
| `settings.volume` | `number` | Volume (0-1) |
| `settings.streamerMode` | `boolean` | Hide sensitive info |
| `settings.iconShape` | `IconShape` | Icon shape setting |
| `enabledApps` | `string[]` | Apps the player can access |
| `appLayout` | `AppLayout` | Home/menu app ordering |
| `featureFlags` | `PhoneFeatureFlags` | Server-toggled features |
| `accessMode` | `'own' \| 'foreign-readonly' \| 'foreign-full'` | Phone access mode |

**PhoneActions** (key methods):

| Method | Description |
|---|---|
| `show()` / `hide()` / `toggle()` | Visibility |
| `lock()` / `unlock(code)` / `unlockDirect()` | Lock screen |
| `setWallpaper(url)` | Change wallpaper |
| `setTheme(theme)` | Change theme |
| `setLanguage(lang)` | Change language |
| `setPhoneScale(scale)` | Change phone scale (0.7-1) |
| `setIconShape(shape)` | Change icon shape |
| `loadAppLayout()` / `saveAppLayout()` | Persist app ordering |
| `createFolder(name, apps, color)` | Create app folder |
| `factoryReset()` | Reset phone |

### useContacts()

```ts
import { useContacts } from '@/store/contacts';
const [contactsState, contactsActions] = useContacts();
```

**ContactsState:**

| Field | Type |
|---|---|
| `contacts` | `Contact[]` |
| `loading` | `boolean` |

**ContactsActions:**

| Method | Signature |
|---|---|
| `fetch` | `() => Promise<void>` |
| `add` | `(display, number, avatar?) => Promise<boolean>` |
| `update` | `(id, display, number, avatar?) => Promise<boolean>` |
| `remove` | `(id) => Promise<boolean>` |
| `toggleFavorite` | `(id) => Promise<boolean>` |
| `findByNumber` | `(number) => Contact \| undefined` |
| `findByName` | `(name) => Contact \| undefined` |

### useMessages()

```ts
import { useMessages } from '@/store/messages';
const [messagesState, messagesActions] = useMessages();
```

**MessagesState:**

| Field | Type |
|---|---|
| `messages` | `Message[]` |
| `loading` | `boolean` |
| `unreadCount` | `number` |

**MessagesActions:**

| Method | Signature |
|---|---|
| `fetch` | `() => Promise<void>` |
| `getConversation` | `(phoneNumber) => Message[]` |
| `send` | `(SendOptions) => Promise<boolean>` |
| `delete` | `(messageId) => Promise<boolean>` |
| `deleteConversation` | `(phoneNumber) => Promise<boolean>` |
| `markAsRead` | `(phoneNumber) => Promise<boolean>` |
| `getUnreadCount` | `() => number` |
| `react` | `(messageId, emoji) => Promise<boolean>` |
| `removeReaction` | `(messageId) => Promise<boolean>` |

**SendOptions:**

```ts
interface SendOptions {
  phoneNumber: string;
  message: string;
  mediaUrl?: string;
  replyToId?: number;
  messageType?: 'text' | 'audio';
  audioData?: string;
  audioDuration?: number;
}
```

### useNotifications()

```ts
import { useNotifications } from '@/store/notifications';
const [notifState, notifActions] = useNotifications();
```

**NotificationsState** (key fields):

| Field | Type |
|---|---|
| `queue` | `PhoneNotification[]` |
| `history` | `PhoneNotification[]` |
| `current` | `PhoneNotification \| null` |
| `doNotDisturb` | `boolean` |
| `airplaneMode` | `boolean` |
| `silentMode` | `boolean` |
| `focusMode` | `FocusModeId` |
| `brightness` | `number` |
| `mutedApps` | `string[]` |

**NotificationsActions** (key methods):

| Method | Description |
|---|---|
| `receive(payload)` | Push a notification |
| `remove(id)` | Remove by ID |
| `dismissCurrent()` | Dismiss the current banner |
| `clear()` | Clear all |
| `setDoNotDisturb(bool)` | Toggle DND |
| `setAirplaneMode(bool)` | Toggle airplane mode |
| `setFocusMode(mode)` | Set focus mode |
| `markAppAsRead(appId)` | Mark app notifications read |
| `getUnreadCount(appId)` | Unread count for app |
| `toggleMuteApp(appId)` | Mute/unmute app |

### useLiveActivity()

```ts
import { useLiveActivity } from '@/store/liveActivity';
const liveActivity = useLiveActivity();
```

**LiveActivityStore:**

| Method/Property | Type |
|---|---|
| `activities()` | `LiveActivity[]` (sorted by priority) |
| `topActivity()` | `LiveActivity \| undefined` |
| `setActivity(type, data)` | Add/update an activity |
| `removeActivity(type)` | Remove an activity |

**LiveActivityType:** `'music' | 'radio' | 'call' | 'cityride' | 'timer' | 'recording' | 'location'`

## When to Use Local vs Global State

| Scenario | Use |
|---|---|
| UI state (tabs, selections, modals) | `createAppStore` |
| Fetched data scoped to one app | `createAppLoader` |
| Data shared across apps (contacts, messages) | Global store |
| Data that must survive app close/reopen | Global store or localStorage |

## Persistence

Some settings are persisted to `localStorage` with the prefix `gcphone:`:

| Key | Description |
|---|---|
| `gcphone:accentColor` | Accent color |
| `gcphone:fontSize` | Font size |
| `gcphone:phoneCase` | Phone case skin |
| `gcphone:iconShape` | Icon shape |
| `gcphone:phoneScale` | Phone scale |
| `gcphone:swipeUnlock` | Swipe unlock pref |
| `gcphone:screenLockEnabled` | Screen lock enabled |
| `gcphone:focusMode` | Focus mode |
| `gcphone:focusModeConfigs` | Focus mode configs (JSON) |
| `gcphone:controlTileOrder` | Control center tile order (JSON) |
| `gcphone:notificationCompact` | Compact notification mode |
| `gcphone:mutedApps` | Muted apps list (JSON) |
