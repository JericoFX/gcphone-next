---
title: Phone Store
---

# Phone Store

The phone store (`web/src/store/phone.tsx`) is the central state manager for the entire phone. It holds device settings, app layout, feature flags, and access control. All apps read from it and some write to it.

## Accessing the Store

```tsx
import { usePhone, usePhoneState, usePhoneActions } from '../../store/phone';

// Full context (state + actions)
const [phoneState, phoneActions] = usePhone();

// State only (more efficient for read-only components)
const phoneState = usePhoneState();

// Actions only
const phoneActions = usePhoneActions();
```

## State Shape

```typescript
interface PhoneState {
  visible: boolean;
  locked: boolean;
  initialized: boolean;

  framework?: 'esx' | 'qbcore' | 'qbox' | 'unknown';
  imei?: string;
  deviceOwnerName?: string;
  resourceVersion?: string;

  isStolen?: boolean;
  stolenAt?: string | null;
  stolenReason?: string | null;

  settings: PhoneSettings;
  appLayout: AppLayout;
  enabledApps: string[];
  featureFlags: PhoneFeatureFlags;

  requiresSetup: boolean;
  setup: PhoneSetupState;

  accessMode?: 'own' | 'foreign-readonly' | 'foreign-full';
  accessOwnerName?: string;
  accessPhoneId?: string;
}
```

### PhoneSettings

```typescript
interface PhoneSettings {
  phoneNumber: string;
  wallpaper: string;            // URL or relative path
  ringtone: string;             // Tone ID
  callRingtone?: string;
  notificationTone?: string;
  messageTone?: string;
  volume: number;               // 0-1
  lockCode: string;             // "0000" = no PIN
  swipeUnlock?: boolean;
  screenLockEnabled?: boolean;
  theme: 'auto' | 'light' | 'dark';
  language?: 'es' | 'en' | 'pt' | 'fr';
  audioProfile?: 'normal' | 'street' | 'vehicle' | 'silent';
  accentColor?: string;         // localStorage only
  fontSize?: string;            // localStorage only
  phoneCase?: string;           // localStorage only
  phoneScale?: number;          // 0.7-1.0, localStorage only
  streamerMode?: boolean;
  playerName?: string;
}
```

### AppLayout

```typescript
interface AppLayout {
  home: string[];   // App IDs on home screen
  menu: string[];   // App IDs in app drawer
}
```

### PhoneFeatureFlags

Controls which optional apps are available. Each flag enables/disables one or more apps.

```typescript
interface PhoneFeatureFlags {
  appstore: boolean;
  wavechat: boolean;
  darkrooms: boolean;
  clips: boolean;
  wallet: boolean;
  mail: boolean;
  documents: boolean;
  music: boolean;
  yellowpages: boolean;
}
```

### PhoneSetupState

```typescript
interface PhoneSetupState {
  requiresSetup: boolean;
  hasSnap?: boolean;
  hasChirp?: boolean;
  hasClips?: boolean;
  hasMail?: boolean;
  mailDomain?: string;
  emergencyContacts?: Array<{ label: string; number: string }>;
}
```

## Actions

All write actions check `isReadOnly()` internally and return early if the phone is in `foreign-readonly` mode.

### Visibility

| Action | Signature | Description |
|--------|-----------|-------------|
| `show` | `() => void` | Show the phone |
| `hide` | `() => void` | Hide the phone |
| `toggle` | `() => void` | Toggle visibility |

### Lock Screen

| Action | Signature | Description |
|--------|-----------|-------------|
| `unlock` | `(code: string) => Promise<boolean>` | Unlock with PIN |
| `unlockDirect` | `() => void` | Unlock without PIN (swipe/tap) |
| `lock` | `() => void` | Lock the phone |
| `verifyPin` | `(code: string) => Promise<boolean>` | Verify PIN without unlocking |

### Settings

| Action | Signature |
|--------|-----------|
| `setWallpaper` | `(url: string) => void` |
| `setRingtone` | `(id: string) => void` |
| `setCallRingtone` | `(id: string) => void` |
| `setNotificationTone` | `(id: string) => void` |
| `setMessageTone` | `(id: string) => void` |
| `setVolume` | `(volume: number) => void` |
| `setTheme` | `(theme: 'auto' \| 'light' \| 'dark') => void` |
| `setLanguage` | `(lang: string) => void` |
| `setAudioProfile` | `(profile: string) => void` |
| `setLockCode` | `(code: string) => void` |
| `setPhoneScale` | `(scale: number) => void` |
| `setSwipeUnlock` | `(enabled: boolean) => void` |
| `setScreenLockEnabled` | `(enabled: boolean) => void` |
| `setAccentColor` | `(color: string) => void` |
| `setFontSize` | `(size: string) => void` |
| `setPhoneCase` | `(name: string) => void` |

### App Layout

| Action | Signature | Description |
|--------|-----------|-------------|
| `loadAppLayout` | `() => Promise<void>` | Fetch layout from server |
| `saveAppLayout` | `() => Promise<void>` | Persist layout to server |
| `reorderApp` | `(target, appId, index) => void` | Move app within home/menu |
| `moveApp` | `(appId, from, to, index?) => void` | Move app between home and menu |

### Setup & Reset

| Action | Signature | Description |
|--------|-----------|-------------|
| `refreshSetupState` | `() => Promise<void>` | Re-fetch setup state from server |
| `completeSetup` | `(payload) => Promise<{success, error?}>` | Complete initial phone setup |
| `factoryReset` | `() => Promise<boolean>` | Erase all data, return to setup |

## Phone Payload (Server → Client)

When the phone initializes or shows, the server sends a `PhonePayload`:

```typescript
interface PhonePayload {
  phoneNumber: string;
  framework: string;
  imei: string;
  deviceOwnerName?: string;
  wallpaper: string;
  ringtone: string;
  callRingtone?: string;
  notificationTone?: string;
  messageTone?: string;
  volume: number;
  lockCode: string;
  theme: string;
  language: string;
  audioProfile: string;
  streamerMode?: boolean;
  appLayout?: AppLayout;
  enabledApps?: string[];
  featureFlags?: Partial<PhoneFeatureFlags>;
  requiresSetup: boolean;
  setup: PhoneSetupState;
  isStolen?: boolean;
  stolenAt?: string;
  stolenReason?: string;
  accessMode?: 'own' | 'foreign-readonly' | 'foreign-full';
  accessOwnerName?: string;
  accessPhoneId?: string;
  resourceVersion?: string;
}
```

## Read-Only Mode

When a player accesses another player's phone, `accessMode` is set to `'foreign-readonly'`. All write actions are blocked. Apps should check this:

```tsx
const phoneState = usePhoneState();
const isReadOnly = () => phoneState.accessMode === 'foreign-readonly';

// Disable write operations
<button disabled={isReadOnly()}>Edit</button>
```

## Other Stores

The phone has 4 additional stores alongside the core PhoneStore:

### ContactsStore (`store/contacts.tsx`)

```tsx
import { useContacts, useContactsState, useContactsActions } from '../store/contacts';
const [state, actions] = useContacts();
```

| Action | Signature | Description |
|--------|-----------|-------------|
| `fetch` | `() => Promise<void>` | Fetch all contacts from server |
| `add` | `(display, number, avatar?) => Promise<boolean>` | Create a new contact |
| `update` | `(id, display, number, avatar?) => Promise<boolean>` | Update existing contact |
| `remove` | `(id: number) => Promise<boolean>` | Delete a contact |
| `toggleFavorite` | `(id: number) => Promise<boolean>` | Toggle favorite status |
| `findByNumber` | `(number: string) => Contact \| undefined` | Local lookup by phone number |
| `findByName` | `(name: string) => Contact \| undefined` | Local lookup by display name |

### MessagesStore (`store/messages.tsx`)

```tsx
import { useMessages, useMessagesState, useMessagesActions } from '../store/messages';
const [state, actions] = useMessages(); // state: { messages, loading, unreadCount }
```

| Action | Signature | Description |
|--------|-----------|-------------|
| `fetch` | `() => Promise<void>` | Fetch all messages from server |
| `getConversation` | `(phoneNumber: string) => Message[]` | Get messages for a phone number (memoized) |
| `send` | `(options: SendOptions) => Promise<boolean>` | Send a message (text or audio) |
| `delete` | `(messageId: number) => Promise<boolean>` | Delete a single message |
| `deleteConversation` | `(phoneNumber: string) => Promise<boolean>` | Delete all messages with a number |
| `markAsRead` | `(phoneNumber: string) => Promise<boolean>` | Mark conversation as read |
| `getUnreadCount` | `() => number` | Total unread count |
| `react` | `(messageId, emoji) => Promise<boolean>` | Add reaction to a message |
| `removeReaction` | `(messageId) => Promise<boolean>` | Remove own reaction |

Messages are capped at 2000 entries. Oldest are dropped when the limit is reached.

### NotificationsStore (`store/notifications.tsx`)

```tsx
import { useNotifications } from '../store/notifications';
const [state, actions] = useNotifications();
```

| Action | Signature | Description |
|--------|-----------|-------------|
| `receive` | `(payload) => void` | Process notification through filter pipeline |
| `remove` | `(id: string) => void` | Remove from queue and history |
| `dismissCurrent` | `() => void` | Dismiss current, show next in queue |
| `clear` | `() => void` | Clear all notifications |
| `setDoNotDisturb` | `(value: boolean) => void` | Toggle DND |
| `setAirplaneMode` | `(value: boolean) => void` | Toggle airplane mode (synced to server) |
| `setSilentMode` | `(value: boolean) => void` | Toggle silent mode |
| `setFocusMode` | `(mode: FocusModeId) => void` | Set focus mode (localStorage) |
| `cycleFocusMode` | `() => void` | Cycle: off → personal → work → driving → sleep |
| `setBrightness` | `(value: number) => void` | Screen brightness (0.4-1.2) |
| `markAppAsRead` | `(appId: string) => void` | Clear app badge |
| `getUnreadCount` | `(appId: string) => number` | Unread count for an app |
| `toggleMuteApp` | `(appId: string) => void` | Silence app notifications |

#### Notification Filtering Pipeline

```
1. Muted apps  → appId in mutedApps AND priority !== 'high' → DROPPED
2. DND         → doNotDisturb AND priority !== 'high' → DROPPED
3. Focus mode  → focusMode !== 'off' AND priority !== 'high'
                  AND appId not in allowedApps → DROPPED
4. Accepted    → added to history (max 40) and queued (max 20)
```

High-priority notifications always pass through all filters.

| Focus Mode | Allowed Apps |
|------------|-------------|
| `personal` | messages, calls, mail |
| `work` | calls, mail, messages, notes |
| `driving` | calls, maps |
| `sleep` | calls |

### LiveActivityStore (`store/liveActivity.tsx`)

```tsx
import { useLiveActivity } from '../store/liveActivity';
const la = useLiveActivity();
la.topActivity();   // highest-priority or undefined
la.activities();    // sorted LiveActivity[]
la.setActivity('radio', { title: 'FM 101.5', isPlaying: true });
la.removeActivity('radio');
```

Activity types by priority (0 = highest): `call`(0), `recording`(1), `cityride`(2), `radio`(3), `music`(4), `timer`(5), `location`(6).

## NUI Events

### Inbound (server → store)

| Event | Store | Description |
|-------|-------|-------------|
| `phone:init` | Phone | Initial phone data on resource start |
| `phone:show` | Phone | Show phone with updated settings |
| `phone:hide` | Phone | Hide phone and reset access state |
| `phone:stolenUpdate` | Phone | Update stolen status |
| `contactsUpdated` | Contacts | Full contact list replacement |
| `contactAdded` | Contacts | Single contact added |
| `contactDeleted` | Contacts | Contact ID removed |
| `messageSent` | Messages | Outgoing message confirmed |
| `messageReceived` | Messages | Incoming message |
| `messagesUpdated` | Messages | Full message list replacement |
| `messageRead` | Messages | Read receipt from recipient |
| `messageReaction` | Messages | Reaction update |
| `messageTyping` | Messages | Typing indicator |
| `phone:notification` | Notifications | Push notification |
| `phone:focusMode` | Notifications | Set focus mode remotely |

### Outbound (store → server via fetchNui)

| NUI Call | Trigger |
|----------|---------|
| `nuiReady` | On mount |
| `phoneVerifyPin` | `unlock`, `verifyPin` |
| `phoneGetSetupState` | `refreshSetupState` |
| `phoneCompleteSetup` | `completeSetup` |
| `setWallpaper` | `setWallpaper` |
| `setRingtone` | `setRingtone` |
| `setCallRingtone` | `setCallRingtone` |
| `setNotificationTone` | `setNotificationTone` |
| `setMessageTone` | `setMessageTone` |
| `setVolume` | `setVolume` |
| `setTheme` | `setTheme` |
| `setLanguage` | `setLanguage` |
| `setAudioProfile` | `setAudioProfile` |
| `setStreamerMode` | `setStreamerMode` |
| `setLockCode` | `setLockCode` |
| `factoryResetPhone` | `factoryReset` |
| `getAppLayout` | `loadAppLayout` |
| `setAppLayout` | `saveAppLayout` |
| `getContacts` | contacts `fetch` |
| `addContact` | contacts `add` |
| `updateContact` | contacts `update` |
| `deleteContact` | contacts `remove` |
| `toggleFavorite` | contacts `toggleFavorite` |
| `getMessages` | messages `fetch` |
| `sendMessage` | messages `send` |
| `deleteMessage` | messages `delete` |
| `deleteConversation` | messages `deleteConversation` |
| `markAsRead` | messages `markAsRead` |
| `reactToMessage` | messages `react` |
| `removeReaction` | messages `removeReaction` |
| `setAirplaneMode` | notifications `setAirplaneMode` |

## localStorage Keys

The phone persists some preferences client-side. All keys start with `gcphone:` and are cleared on factory reset.

| Key | Purpose |
|-----|---------|
| `gcphone:language` | Display language |
| `gcphone:accentColor` | UI accent color |
| `gcphone:fontSize` | Text size preference |
| `gcphone:phoneCase` | Phone skin |
| `gcphone:phoneScale` | UI scale (0.7-1.0) |
| `gcphone:swipeUnlock` | Swipe unlock toggle |
| `gcphone:screenLockEnabled` | Lock screen toggle |
| `gcphone:focusMode` | Active focus mode |
| `gcphone:focusModeConfigs` | Focus mode settings |
| `gcphone:controlTileOrder` | Quick settings order |
| `gcphone:mutedApps` | Muted notification apps |
