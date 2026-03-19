---
title: Getting Started
---

# Getting Started

This guide covers installing gcphone-next, configuring your server, and verifying the first boot.

## Prerequisites

- FiveM server **build 5181** or newer
- **OneSync** enabled in your server config
- **ox_lib** installed and started
- **oxmysql** installed and started (MySQL or MariaDB)
- **gcphone_sounds** resource (native audio bank)
- A supported framework: **QBCore** (`qb-core`), **QBox** (`qbx_core`), or **ESX** (`es_extended`)
- **Bun** (or Node.js) to build the web frontend
- **Docker + Docker Compose** if you plan to self-host LiveKit for video calls

## Installation

1. Download or clone the repository into your FiveM resources folder:

   ```
   resources/[phone]/gcphone-next/
   ```

2. Build the web frontend:

   ```bash
   cd resources/[phone]/gcphone-next/web
   bun install
   bun run build
   ```

   This produces the `web/dist/` directory that FiveM serves as the NUI page.

3. Add the resource to your `server.cfg`:

   ```cfg
   ensure oxmysql
   ensure ox_lib
   ensure qb-core          # or qbx_core or es_extended
   ensure gcphone_sounds
   ensure gcphone-next
   ```

## Boot Order

Resources must start in this order:

1. `oxmysql`
2. `ox_lib`
3. Your framework (`qb-core`, `qbx_core`, or `es_extended`)
4. External services (LiveKit, Socket.IO) if used
5. `gcphone_sounds`
6. `gcphone-next`

The resource declares these dependencies in `fxmanifest.lua`:

```lua
dependencies {
    '/server:5181',
    '/onesync',
    'ox_lib',
    'oxmysql',
    'gcphone_sounds',
}
```

## server.cfg Convars

### LiveKit (video calls)

If you are self-hosting LiveKit for WebRTC video calls, add these convars:

```cfg
setr livekit_host "ws://YOUR_SERVER_IP:7880"
setr livekit_api_key "YOUR_KEY"
setr livekit_api_secret "YOUR_SECRET"
setr livekit_room_prefix "gcphone"
setr livekit_max_call_duration "300"
```

- `livekit_host` must start with `ws://` or `wss://`.
- `livekit_api_key` and `livekit_api_secret` are **server-side only** -- never expose them in client or web code.
- See the [LiveKit Setup Guide](/guides/livekit-setup) for full instructions.

### Socket.IO (optional real-time chat)

If you want real-time chat via Socket.IO:

```cfg
setr gcphone_socket_host "ws://YOUR_SERVER_IP:3001"
setr gcphone_socket_jwt_secret "YOUR_JWT_SECRET"
```

- Socket.IO is **optional**. Only enable it if you actually use it.
- The JWT secret must match the one configured on your Socket.IO server.
- See the [Socket.IO Setup Guide](/guides/socket-setup) for details.

## Config.lua Overview

The main configuration file is `shared/config.lua`. Key sections:

| Section | Purpose |
|---|---|
| `Config.Framework` | Set to `'qbcore'`, `'qbox'`, or `'esx'` |
| `Config.Phone` | Key bindings, number format/prefix, default settings, setup wizard, item requirement |
| `Config.NativeAudio` | Sound bank, ringtone catalog, default tones per category |
| `Config.Calls` | WebRTC toggle, max call duration, hidden number prefix |
| `Config.LiveKit` | Enable/disable LiveKit, max call duration |
| `Config.Socket` | Enable/disable Socket.IO |
| `Config.Features` | Toggle apps on/off (AppStore, WaveChat, DarkRooms, Clips, Wallet, Documents, Music, YellowPages, Mail) |
| `Config.Camera` | Camera sensitivity, FOV, offsets, freeze settings |
| `Config.Flashlight` | Flashlight distance, intensity, kelvin/lumens range |
| `Config.Music` | Music player volume, distance, max results |
| `Config.Storage` | Upload provider (FiveManage, server folder, local, custom URL) |
| `Config.Gallery` | Max photos, allowed formats, size limits |
| `Config.Bank` | Transfer fee, max transfer amount |
| `Config.Wallet` | Initial balance, max transfer, proximity distance |
| `Config.Chirp` | Max tweet length, daily limits, media toggle |
| `Config.Snap` | Story duration, daily limits, live streaming settings |
| `Config.Garage` | Max vehicles, spawn points, impound locations |
| `Config.Market` | Listing limits, duration, categories |
| `Config.News` | Article limits, live streaming, categories |
| `Config.Mail` | Domain, alias length, body length, attachment limits |
| `Config.Security` | Rate limits per action type |
| `Config.Proximity` | Distance thresholds for sharing contacts, locations, documents, photos |
| `Config.APIs` | API keys for Unsplash, Picsum, Tenor, Piped (YouTube proxy) |

### Phone Item Requirement

By default, all players can open the phone. To require an ox_inventory item:

```lua
Config.Phone = {
    RequireItem = true,
    ItemName = 'phone',
    -- ...
}
```

### Phone Number Format

```lua
Config.Phone = {
    NumberFormat = 'XXX-XXXX',
    NumberPrefix = { 555, 556, 557, 558, 559 },
    -- ...
}
```

## Database Setup

gcphone-next uses an **automatic migration system**. No manual SQL is required.

When the resource starts, `server/modules/database.lua` runs migrations automatically:

1. It waits for oxmysql to be ready.
2. Creates a `phone_migrations` tracking table.
3. Checks the current database version.
4. Applies any pending migrations in order.

The migration system currently has 18 versions covering:

- Core tables (phone_numbers, contacts, messages, calls, gallery, etc.)
- Social tables (chirp accounts/tweets, snap accounts/posts, clips)
- Dark Rooms (rooms, posts, comments, votes)
- Wallet and Documents
- Mail system
- Notification inbox
- SQL cleanup rules and scheduled events
- Performance indexes and auto-counter triggers

You can check the current database version at any time via the server export:

```lua
local version = exports['gcphone-next']:GetDatabaseVersion()
```

## Build Instructions

### Full rebuild of the web frontend

```bash
cd resources/[phone]/gcphone-next/web
bun install
bun run build
```

### Type checking only

```bash
cd resources/[phone]/gcphone-next/web
bun run typecheck
```

## Verification After Start

1. Open the phone in-game and confirm the initial load screen appears.
2. Test a social action (follow request or post).
3. If LiveKit is enabled, test a video call.
4. Check the server console for errors -- look for `[gcphone-next]` prefixed messages.

## Troubleshooting

| Error | Fix |
|---|---|
| `MISSING_HOST` or `INVALID_HOST_SCHEME` (LiveKit) | Check `livekit_host` convar -- must start with `ws://` or `wss://` |
| 401 on LiveKit token | Verify `livekit_api_key` and `livekit_api_secret` match your LiveKit server |
| `MISSING_SOCKET_HOST` or `INVALID_SOCKET_HOST_SCHEME` | Check `gcphone_socket_host` convar |
| Setup script closes immediately | Run `tools\livekit\setup-livekit.bat` from `cmd` (not double-click) to see the error |
| Database migration failed | Check the server console for the specific migration version and SQL error |
