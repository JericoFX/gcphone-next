---
title: Phone SDK Permissions
---

# Phone SDK — Permissions

The Phone UI SDK includes a permission system that controls access to sensitive phone APIs. Both internal phone apps and external third-party apps must request permissions before accessing protected features.

> **Important:** A third-party app can be potentially harmful if it comes from an unknown or untrusted source. Malicious apps may request permissions to read contacts, send messages, or access the player's location. The permission system exists so that the player can make an informed decision before granting access. If an app seems suspicious (for example, a clothing store requesting access to contacts and messages), the player should deny the permissions. Blocked apps can be removed from Settings > Apps and Permissions.

---

## How It Works

1. **Declaration:** The developer declares required permissions when registering a UI
2. **Prompt:** The first time the app opens, the player sees a permission modal
3. **Decision:** The player grants or rejects all requested permissions
4. **Persistence:** The decision is saved to the database and not asked again
5. **Revocation:** The player can change permissions later in Settings > Apps

---

## Available Permissions

| Permission ID | Display Name | Description | Used By |
|---------------|-------------|-------------|---------|
| `location` | GPS Location | Read player coordinates | Maps, taxi apps |
| `contacts` | Contacts | Read the contact list | WaveChat, Messages, social apps |
| `messages` | Messages | Send SMS from the player's phone | Messages, notification/alert apps |
| `notifications` | Notifications | Send persistent notifications | All apps, delivery/status apps |
| `camera` | Camera | Take photos and get the URL | Camera, Snap, WaveChat |
| `microphone` | Microphone | Voice recording | WaveChat |
| `gallery` | Gallery | Access saved photos | Gallery, Snap, WaveChat |
| `calls` | Calls | Initiate phone calls | Contacts, WaveChat, emergency apps |
| `maps` | Maps | Set waypoints and open the maps app | Maps, navigation apps |
| `storage` | Storage | Upload files to storage provider | Camera, Snap |

---

## Declaring Permissions

### External Apps

Add a `permissions` array to `registerPhoneUI`:

```lua
exports['gcphone-next']:registerPhoneUI('taxi_app', {
  title = 'CityTaxi',
  icon = '🚕',
  permissions = { 'location', 'notifications', 'maps' },
  -- ...
})
```

### Internal Apps

Internal phone apps (WaveChat, Snap, etc.) also declare permissions. These are configured in the phone's internal app registry and follow the same prompt/grant flow.

| Internal App | Permissions |
|---|---|
| WaveChat | `camera`, `microphone`, `contacts`, `gallery` |
| Snap | `camera`, `gallery`, `storage`, `contacts` |
| Camera | `camera`, `storage` |
| Messages | `contacts` |
| Maps | `location` |
| Gallery | `gallery`, `storage` |
| Contacts | `contacts` |

---

## Permission Prompt

When a player opens an app with undecided permissions, a modal appears:

```
┌──────────────────────────────┐
│                              │
│  🚕 CityTaxi                │
│  quiere acceder a:           │
│                              │
│  📍 Tu ubicacion             │
│  🔔 Notificaciones           │
│  🗺️ Mapas                    │
│                              │
│  [Rechazar]     [Permitir]   │
│                              │
└──────────────────────────────┘
```

- Permissions are requested as a batch (all at once on first open)
- The player grants or rejects ALL permissions together
- The decision persists across sessions

---

## Permission-Gated API Exports

These exports are available for external resources. Each requires the corresponding permission to be granted for the calling app.

### `phoneNotify(source, appId, payload)`

Send a notification to the player's phone. Requires `notifications` permission.

**Side:** Server

```lua
exports['gcphone-next']:phoneNotify(source, 'my_app', {
  title = 'Pedido en camino',
  content = 'Tu comida llega en 5 minutos',
  icon = '🚗',
})
```

### `phoneWaypoint(source, appId, payload)`

Set a map waypoint. Requires `maps` permission.

**Side:** Server

```lua
exports['gcphone-next']:phoneWaypoint(source, 'my_app', {
  x = 215.3,
  y = -810.5,
  label = 'Tu destino',
})
```

### `phoneSendMessage(source, appId, payload)`

Send an SMS from the player's phone. Requires `messages` permission.

**Side:** Server

```lua
exports['gcphone-next']:phoneSendMessage(source, 'my_app', {
  to = '555-1234',
  message = 'Tu taxi llega en 3 minutos',
})
```

### `phoneGetContacts(source, appId)`

Read the player's contact list. Requires `contacts` permission.

**Side:** Server

**Returns:** `table[]|false, string?` — array of `{ number, display }` or `false, 'PERMISSION_DENIED'`

```lua
local contacts, err = exports['gcphone-next']:phoneGetContacts(source, 'my_app')
if contacts then
  for _, c in ipairs(contacts) do
    print(c.display, c.number)
  end
end
```

### `phoneGetLocation(source, appId)`

Get the player's GPS coordinates. Requires `location` permission.

**Side:** Server

**Returns:** `table|false, string?` — `{ x, y, z }` or `false, 'PERMISSION_DENIED'`

```lua
local coords, err = exports['gcphone-next']:phoneGetLocation(source, 'my_app')
if coords then
  print(coords.x, coords.y, coords.z)
end
```

### `phoneStartCall(source, appId, payload)`

Initiate a call from the player's phone. Requires `calls` permission.

**Side:** Server

```lua
exports['gcphone-next']:phoneStartCall(source, 'my_app', {
  number = '911',
})
```

### `phoneGetGallery(source, appId)`

Access the player's photo gallery. Requires `gallery` permission.

**Side:** Server

**Returns:** `table[]|false, string?` — array of `{ url, type }` or `false, 'PERMISSION_DENIED'`

### `hasPhonePermission(source, appId, permission)`

Check if a permission is granted without triggering the prompt.

**Side:** Server

**Returns:** `true|false|nil` — `true` if granted, `false` if denied, `nil` if never asked.

```lua
local granted = exports['gcphone-next']:hasPhonePermission(source, 'my_app', 'location')
if granted == nil then
  -- Permission never requested; it will be prompted on first open
elseif granted then
  -- Permission granted
else
  -- Permission denied
end
```

---

## Managing Permissions (Player Side)

### Settings > Apps and Permissions

Players can manage permissions in the phone's Settings app:

- View all apps (internal + external) that have requested permissions
- See which permissions each app has (granted/denied)
- Toggle individual permissions on/off
- **"Remove app"** — uninstall a third-party app (revokes permissions, hides from Shortcuts, blocks future opens)

### Uninstalling / Blocking Apps

When a player uninstalls a third-party app:
- The app disappears from Shortcuts
- All permissions are revoked
- Future `openPhoneUI` calls return `nil, 'APP_BLOCKED'`
- The block persists in the database
- The player can reinstall from Settings > Apps > Blocked

Internal apps (WaveChat, Snap, etc.) cannot be uninstalled, only have their permissions toggled.

---

## Database Tables

### `phone_app_permissions`

Stores permission decisions per player per app.

```sql
CREATE TABLE IF NOT EXISTS `phone_app_permissions` (
    `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `identifier`  VARCHAR(50) NOT NULL,
    `app_id`      VARCHAR(64) NOT NULL,
    `permission`  VARCHAR(32) NOT NULL,
    `granted`     TINYINT(1) NOT NULL DEFAULT 0,
    `granted_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_perm` (`identifier`, `app_id`, `permission`),
    INDEX `idx_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### `phone_app_blocks`

Stores player app blocks (uninstalls).

```sql
CREATE TABLE IF NOT EXISTS `phone_app_blocks` (
    `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `identifier`  VARCHAR(50) NOT NULL,
    `app_id`      VARCHAR(64) NOT NULL,
    `blocked_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_block` (`identifier`, `app_id`),
    INDEX `idx_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
