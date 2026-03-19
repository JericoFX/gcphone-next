---
title: Exports
---

# Exports

All exports are invoked via `exports['gcphone-next']:ExportName(...)`.

## Bridge (Server)

These exports wrap the active framework bridge (QBCore, ESX, QBOX, etc.) and provide a unified API.

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `GetBridge` | -- | `table` | Returns the full bridge interface table. |
| `GetIdentifier` | `source: integer` | `string\|nil` | Get the player's framework identifier (e.g. citizenid, license). |
| `GetName` | `source: integer` | `string\|nil` | Get the player's character name. |
| `GetMoney` | `source: integer, accountType?: string` | `number` | Get the player's money balance. Returns `0` on failure. |
| `AddMoney` | `source: integer, amount: number, accountType?: string, reason?: string` | `boolean` | Add money to the player's account. |
| `RemoveMoney` | `source: integer, amount: number, accountType?: string, reason?: string` | `boolean` | Remove money from the player's account. |
| `GetJob` | `source: integer` | `table\|nil` | Get the player's current job/gang info. |
| `GetFramework` | -- | `string\|nil` | Get the name of the detected framework. |
| `GetSourceFromIdentifier` | `identifier: string` | `integer\|nil` | Resolve a server source from a framework identifier. |
| `IsPlayerActionAllowed` | `source: integer` | `boolean` | Check if the player is allowed to perform phone actions (alive, not in jail, etc.). |

## Phone Management (Server)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `GetPhoneNumber` | `identifier: string, requestSource?: integer` | `string\|nil` | Get a phone number by owner identifier. When `requestSource` is provided, access-control checks are enforced. |
| `GetIdentifierByPhone` | `phoneNumber: string` | `string\|nil` | Resolve an owner identifier from a phone number. |
| `GetPhoneByIdentifier` | `identifier: string, requestSource?: integer` | `GCPhoneLookupResponse` | Get full phone record (number, IMEI, stolen state) for an identifier. |
| `GetPhoneOwnerByIMEI` | `imei: string` | `GCPhoneLookupResponse` | Get phone owner details by IMEI. Requires authorized caller. |
| `GetPhoneOwnerByNumber` | `phoneNumber: string` | `GCPhoneLookupResponse` | Get phone owner details by phone number. Requires authorized caller. |
| `MarkPhoneAsStolenByIMEI` | `imei: string, reason?: string, reporter?: string` | `GCPhoneStolenMutationResponse` | Mark a phone as stolen by IMEI. Notifies owner if online. |
| `MarkPhoneAsStolenByNumber` | `phoneNumber: string, reason?: string, reporter?: string` | `GCPhoneStolenMutationResponse` | Mark a phone as stolen by phone number. Notifies owner if online. |
| `ClearPhoneStolenByIMEI` | `imei: string` | `GCPhoneStolenMutationResponse` | Clear stolen state by IMEI. |
| `ClearPhoneStolenByNumber` | `phoneNumber: string` | `GCPhoneStolenMutationResponse` | Clear stolen state by phone number. |
| `PlayerHasPhoneItem` | `source: integer` | `boolean` | Check if a player has a phone item (ox_inventory). Always true when `RequireItem` is disabled. |

### Response Types

```lua
-- GCPhoneLookupResponse
{ success = true, owner = { identifier, name, phoneNumber, imei, isStolen, stolenAt, stolenReason, stolenReporter } }
{ success = false, error = "UNAUTHORIZED" | "PHONE_NOT_FOUND" | "INVALID_IMEI" }

-- GCPhoneStolenMutationResponse
{ success = true, phone = { ... } }
{ success = false, error = "UNAUTHORIZED" | "PHONE_NOT_FOUND" | ... }
```

## Notifications (Server)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `SendPhoneNotification` | `target: integer\|integer[]\|-1, payload: GCPhoneNotificationPayload` | `boolean` | Send an ephemeral phone notification to one or more players. Use `-1` to broadcast. |
| `AddPersistentNotification` | `identifier: string, payload: GCPhoneNotificationPayload` | `integer\|nil` | Insert a persistent notification into the DB and push it live if the owner is online. Returns the notification ID. |

### Notification Payload

```lua
{
    title    = "Title",          -- required
    message  = "Body text",      -- notification body
    content  = "Body text",      -- alias for message
    app      = "messages",       -- app identifier
    appId    = "messages",       -- alias for app
    icon     = "./img/icon.svg", -- optional icon
    avatar   = "url",            -- optional avatar
    priority = "high",           -- bypasses DND/mute when "high"
    route    = "/messages",      -- optional deep-link route
    data     = {},               -- optional payload passed to the app
    meta     = {},               -- optional metadata (persistent only)
}
```

## Security (Server)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `HitRateLimit` | `source: integer, key: string, windowMs: integer, maxHits?: integer` | `boolean` | Hit a named rate-limit bucket. Returns `true` if the limit was exceeded. |
| `IsBlockedByIdentifier` | `identifier: string` | `boolean` | Check if an identifier is blocked from social features. |
| `IsBlockedEither` | `identifierA: string, identifierB: string` | `boolean` | Check if either side of a social interaction is blocked. |
| `RecordReport` | `reporterIdentifier: string, targetIdentifier?: string, targetPhone?: string, appId?: string, evidence?: string\|table` | `nil` | Record a moderation report. |

## Hooks (Server)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `registerHook` | `event: string, cb: function, options?: table` | `integer\|false` | Register a hook callback for a phone event. Returns hook ID. |
| `removeHooks` | `id?: integer` | `nil` | Remove hooks registered by the calling resource. Pass an ID to remove a specific hook. |
| `triggerHook` | `event: string, payload?: table` | `boolean` | Trigger a hook event. Returns `false` if any hook cancelled it. |

See [hooks.md](./hooks.md) for the full hook system documentation.

## Messages (Server)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `GetMessages` | `identifier: string, requestSource?: integer` | `table[]` | Get recent message threads for an identifier. |
| `GetConversation` | `identifier: string, targetNumber: string, requestSource?: integer` | `table[]` | Get a conversation with a specific phone number. |

## Mail (Server)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `SendInGameMail` | `fromIdentifier: string, payload: table` | `table` | Send in-game mail from an identifier. The sender must have a mail account. Returns `{ success, error? }`. |

## Calls (Server)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `GetActiveCalls` | -- | `table<integer, table>` | Get all currently active calls indexed by call ID. |
| `GetCallHistory` | `identifier: string, requestSource?: integer` | `table[]` | Get call history rows for a player identifier. |

## Contacts (Server)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `GetContacts` | `identifier: string, requestSource?: integer` | `table[]` | Get the contact list for an identifier. |

## Gallery (Server)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `GetGallery` | `identifier: string, requestSource?: integer` | `table[]` | Get gallery media for a phone owner. |

## Live (Server)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `GetLiveRoom` | `clipId: integer` | `table\|nil` | Get an active live room by clip/post ID. |

## Wallet (Server)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `CanUseProximityPayment` | `source: integer, targetSource: integer, maxDistance?: number` | `boolean, string\|nil, number\|nil` | Check if two players can use proximity payment. Returns `(allowed, errorCode, distance)`. |
| `ProximityTransfer` | `source: integer, targetSource: integer, amount: number, title?: string, method?: 'qr'\|'nfc'` | `GCWalletTransferResponse` | Execute a proximity wallet transfer between two players. |

## Garage (Server)

### Registration

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `RegisterGarageSpawnPoint` | `id: string, point: GaragePoint` | `nil` | Register a single garage spawn point. |
| `RegisterImpoundLocation` | `id: string, point: GaragePoint` | `nil` | Register a single impound location. |
| `RegisterGarageSpawnPoints` | `list: GaragePoint[], prefix?: string` | `number` | Batch-register spawn points. Returns the count registered. |
| `RegisterImpoundLocations` | `list: GaragePoint[], prefix?: string` | `number` | Batch-register impound locations. Returns the count registered. |

### Removal

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `RemoveGarageSpawnPoint` | `id: string` | `nil` | Remove a spawn point by ID. |
| `RemoveImpoundLocation` | `id: string` | `nil` | Remove an impound location by ID. |
| `ClearGarageSpawnPoints` | `prefix?: string` | `nil` | Clear spawn points. If prefix given, only clears matching IDs. |
| `ClearImpoundLocations` | `prefix?: string` | `nil` | Clear impound locations. If prefix given, only clears matching IDs. |

### Providers

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `SetSpawnPointProvider` | `fn: fun(source): GaragePoint[]\|nil` | `nil` | Set a dynamic callback for additional spawn points. Pass `nil` to remove. |
| `SetImpoundProvider` | `fn: fun(source): GaragePoint[]\|nil` | `nil` | Set a dynamic callback for additional impound locations. Pass `nil` to remove. |

### Query

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `GetGarageSpawnPoints` | -- | `table<string, GaragePoint>` | Get all registered spawn points. |
| `GetImpoundLocations` | -- | `table<string, GaragePoint>` | Get all registered impound locations. |
| `GetNearestSpawnPoint` | `source: number` | `GaragePoint\|nil` | Get the nearest spawn point to a player. |
| `GetNearestImpound` | `source: number` | `GaragePoint\|nil` | Get the nearest impound location to a player. |

### Sync

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `SyncVehicle` | `identifier: string, plate: string, model: string\|number, modelName?: string, garageName?: string, impounded?: boolean, properties?: table, coords?: vector3\|table` | `boolean` | Insert or update a vehicle entry from an external garage resource. |

### GaragePoint Type

```lua
{ id? = "string", label = "string", x = number, y = number, z = number, h? = number }
```

## Database (Server)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `RunMigrations` | -- | `nil` | Run pending database migrations. |
| `GetDatabaseVersion` | -- | `integer` | Get the current database schema version. |

## Phone UI (Client)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `GetPhoneState` | -- | `table` | Get the full phone state table (phoneNumber, wallpaper, volume, etc.). |
| `IsPhoneOpen` | -- | `boolean` | Check whether the phone UI is currently open. |
| `NotifyPhone` | `payload: GCPhoneNotificationPayload` | `boolean` | Push a local phone notification from client Lua. |
| `TogglePhone` | -- | `nil` | Toggle the phone open/closed state. |
| `ClosePhone` | -- | `nil` | Force the phone closed if it is open. |
| `SetPhoneVisualMode` | `mode: string, options?: table` | `nil` | Set the current phone visual mode (e.g. `"text"`, `"call"`, `"camera"`). |
| `GetPhoneVisualMode` | -- | `string, table` | Get the current phone visual mode and its options. |

## Calls (Client)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `IsInCall` | -- | `boolean` | Check if the player is currently in a call. |
| `GetCurrentCallId` | -- | `integer\|nil` | Get the current active call ID. |

## Music (Client)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `isPlayingMusic` | -- | `boolean` | Check if music is currently playing. |
| `isMusicPaused` | -- | `boolean` | Check if music playback is paused. |
| `getCurrentMusicUrl` | -- | `string\|nil` | Get the URL of the currently playing track. |

## Flashlight (Client)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `SetPhoneFlashlightEnabled` | `enabled: boolean` | `nil` | Enable or disable the phone flashlight. |
| `IsPhoneFlashlightEnabled` | -- | `boolean` | Check if the phone flashlight is on. |
| `GetPhoneFlashlightProfile` | -- | `table` | Get the current flashlight profile settings. |

## Native Audio (Client)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `PlayPhoneNativeTone` | `tone: string, ...` | `nil` | Play a native phone tone (ring, notification, etc.). |
| `StopPhoneNativeCallTone` | -- | `nil` | Stop the active call ringtone. |
| `StopPhoneNativePreviewTone` | -- | `nil` | Stop the preview tone playback. |
| `StopPhoneNativeOutgoingTone` | -- | `nil` | Stop the outgoing call tone. |
| `IsPhoneNativeCallToneEnabled` | -- | `boolean` | Check if native call tone is enabled. |

## Phone Animation (Client)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `PlayPhoneAnimation` | `anim: string` | `nil` | Play a named phone animation. |
| `PhonePlayIn` | -- | `nil` | Play the phone-in (pull out) animation. |
| `PhonePlayOut` | -- | `nil` | Play the phone-out (put away) animation. |
| `PhonePlayCall` | -- | `nil` | Play the phone call hold animation. |
| `PhonePlayText` | -- | `nil` | Play the texting animation. |
| `PhonePlayCamera` | -- | `nil` | Play the camera mode animation. |
| `PhonePlayLive` | -- | `nil` | Play the live streaming animation. |

## Proximity (Client)

| Export | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `GetSnapLiveAudioStatus` | -- | `table` | Get the current Snap live audio streaming status. |
| `GetNearbyPlayers` | -- | `table[]` | Get a list of nearby players for proximity features. |
