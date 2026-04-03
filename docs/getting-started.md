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

## Installation

1. Download or clone the repository into your FiveM resources folder:

   ```
   resources/[phone]/gcphone-next/
   ```

2. Install server-side JS dependencies:

   ```bash
   cd resources/[phone]/gcphone-next/server/js
   bun install
   ```

3. Build the web frontend:

   ```bash
   cd resources/[phone]/gcphone-next/web
   bun install
   bun run build
   ```

   This produces the `web/dist/` directory that FiveM serves as the NUI page.

4. Add the resource to your `server.cfg`:

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
4. `gcphone_sounds`
5. `gcphone-next`

## server.cfg Convars

### Cloudflare TURN (optional, recommended for production)

Cloudflare TURN helps players behind strict NATs connect. Free tier: 1 TB/month.

```cfg
set webrtc_turn_token_id "your-cloudflare-token-id"
set webrtc_turn_api_token "your-cloudflare-api-token"
```

Then enable in `shared/config.lua`:

```lua
Config.WebRTC.DynamicTURN.Enabled = true
```

Get credentials at [Cloudflare Dashboard](https://dash.cloudflare.com/) > Realtime > TURN.

Without Cloudflare, gcphone uses free public STUN/TURN servers by default.

### Media Upload (required for photos/videos/audio)

Configure your upload provider. See the [Storage Setup Guide](/guides/storage-setup) for all options.

```cfg
set gcphone_provider "fivemanage"
set gcphone_provider_token "YOUR_FIVEMANAGE_API_TOKEN"
```

Supported providers: `fivemanage`, `discord`, `custom`, `server_folder`, `local`.

## Config.lua Overview

The main configuration file is `shared/config.lua`. Key sections:

| Section | Purpose |
|---|---|
| `Config.Framework` | Set to `'qbcore'`, `'qbox'`, or `'esx'` |
| `Config.Phone` | Key bindings, number format/prefix, default settings, item requirement |
| `Config.NativeAudio` | Sound bank, ringtone catalog, default tones per category |
| `Config.Calls` | Max call duration, hidden number prefix |
| `Config.WebRTC` | TURN/ICE server configuration (Cloudflare or static) |
| `Config.Features` | Toggle apps on/off |
| `Config.Camera` | Camera sensitivity, FOV, offsets, freeze settings |
| `Config.Storage` | Upload settings — provider configured via `server.cfg` convars |

### Phone Item Requirement

By default, all players can open the phone. To require an ox_inventory item:

```lua
Config.Phone = {
    RequireItem = true,
    ItemName = 'phone',
}
```

### Phone Number Format

```lua
Config.Phone = {
    NumberFormat = 'XXX-XXXX',
    NumberPrefix = { 555, 556, 557, 558, 559 },
}
```

## Database Setup

gcphone-next uses an **automatic migration system**. No manual SQL is required.

When the resource starts, `server/modules/database.lua` runs migrations automatically:

1. It waits for oxmysql to be ready.
2. Creates a `phone_migrations` tracking table.
3. Checks the current database version.
4. Applies any pending migrations in order.

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

## Native Audio (gcphone_sounds)

The `gcphone_sounds` resource provides the native GTA audio bank used for ringtones, notification sounds, and other phone audio. It is a **separate resource** that must be installed and started **before** `gcphone-next`.

### Where to get it

Included in the GitHub releases as a separate download (`gcphone-sounds-v*.zip`). Place it in your resources folder:

```
resources/[phone]/gcphone_sounds/
```

### Custom sounds

Use [Audiotool](https://github.com/JericoFX/Audiotool) to compile custom `.awc` audio banks for GTA V.

## Real-Time Chat

All chat (WaveChat groups, DMs, Snap Live, MatchMyLove) uses FiveM native events. No external server required — it works out of the box. See the [Real-Time Chat Guide](/guides/socket-setup) for details.

## Verification After Start

1. Open the phone in-game and confirm the initial load screen appears.
2. Test a social action (follow request or post).
3. Test a video call between two players to verify WebRTC connectivity.
4. Check the server console for errors — look for `[gcphone-next]` prefixed messages.

## Troubleshooting

| Error | Fix |
|---|---|
| `SDK_NOT_INSTALLED` | Run `cd server/js && bun install` |
| Video calls not connecting | Configure TURN servers — see [WebRTC & TURN Setup](/guides/livekit-setup) |
| Database migration failed | Check the server console for the specific migration version and SQL error |
