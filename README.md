# gcphone-next

# ⚠️ WORK IN PROGRESS ⚠️

**This resource has NOT been tested in a live FiveM environment.** Expect bugs, missing features, and breaking changes. Use at your own risk.

You are free to do whatever you want with this resource — fork it, modify it, sell it, burn it, print it and frame it on your wall. No restrictions beyond the GPL-3.0 license.

---

A modernized FiveM phone resource built with **SolidJS**, **ox_lib**, and **oxmysql**.

Fork of [gcphone](https://github.com/manueljlz/gcphone) by manueljlz — fully rewritten architecture.

---

## Features

- **30+ apps**: Contacts, Messages, Calls, Chirp, Snap, Clips, Mail, Bank, Wallet, Documents, Gallery, Garage, Music, News, Dark Rooms, Yellow Pages, WaveChat, Notes, Weather, Maps, Clock, Camera, Notifications, Radio, Services, MatchMyLove, CityRide, and more
- **SolidJS NUI** with iOS 18-inspired design
- **LiveKit WebRTC** video/voice calls and live streaming
- **FiveM native events** for real-time messaging (no external chat server needed)
- **Native audio** system with custom AWC sounds
- **QBCore, QBox, and ESX** framework support via bridge pattern
- **ox_inventory** optional phone item requirement
- **100% parameterized SQL** via oxmysql
- **NUI auth** with per-session token rotation and request signing
- **Rate limiting** per action/player
- **Hook system** for external resource integration
- **Data retention** worker for history cleanup
- **Storage providers**: FiveManage, server folder, local, or custom
- **WebRTC TURN/ICE** with free defaults + optional Cloudflare TURN

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Lua 5.4, ox_lib, oxmysql |
| Client | Lua 5.4, ox_lib |
| NUI | SolidJS, TypeScript, Vite, SCSS |
| Calls & Live | LiveKit (WebRTC) |
| Chat | FiveM native events |
| Audio | GTA V AWC native sounds |

## Requirements

- FiveM server build **5181+** with **OneSync**
- [ox_lib](https://github.com/overextended/ox_lib)
- [oxmysql](https://github.com/overextended/oxmysql)
- [gcphone_sounds](https://github.com/JericoFX/gcphone_sounds) (native audio bank)
- QBCore, QBox, or ESX framework
- **Node.js 18+** (for server-side JS: LiveKit tokens, YouTube search)
- **Bun** (for building the NUI frontend)
- A **LiveKit server** for video calls ([LiveKit Cloud](https://livekit.io/cloud) free tier recommended)

## Quick Start

```bash
# 1. Clone into your resources folder
git clone https://github.com/JericoFX/gcphone-next.git

# 2. Build the NUI
cd gcphone-next/web
bun install
bun run build

# 3. Install server-side JS dependencies
cd ../server/js
npm install          # installs livekit-server-sdk, youtube-sr

# 4. Add to server.cfg
ensure oxmysql
ensure ox_lib
ensure qb-core          # or es_extended
ensure gcphone_sounds
ensure gcphone-next
```

## Configuration

### server.cfg

```cfg
# LiveKit (required for video calls and live streaming)
setr livekit_host "wss://your-project.livekit.cloud"
setr livekit_api_key "APIxxxxxxxx"
setr livekit_api_secret "your-api-secret"
setr livekit_room_prefix "gcphone"
setr livekit_max_call_duration "300"

# Cloudflare TURN (optional — better NAT traversal, 1TB/month free)
set webrtc_turn_token_id "your-cloudflare-token-id"
set webrtc_turn_api_token "your-cloudflare-api-token"

# Media upload (required for photos/videos)
set gcphone_provider "fivemanage"
set gcphone_provider_token "YOUR_FIVEMANAGE_API_TOKEN"
```

See [LiveKit Setup Guide](docs/guides/livekit-setup.md) for details on getting LiveKit Cloud credentials and Cloudflare TURN setup.

### Config.lua

All configuration is in `shared/config.lua`:

- `Config.Phone` — Key bindings, number format, default settings, phone item requirement
- `Config.Features` — Toggle apps on/off (AppStore, WaveChat, DarkRooms, Clips, etc.)
- `Config.Security` — Rate limits per action
- `Config.Storage` — Media upload provider (FiveManage, server folder, local, custom)
- `Config.LiveKit` — Enable/disable LiveKit, max call duration
- `Config.WebRTC` — TURN/ICE server configuration (Cloudflare or static)
- Per-app config: `Config.Chirp`, `Config.Snap`, `Config.Wallet`, etc.

### ox_inventory Integration

To require a phone item in ox_inventory before opening:

```lua
-- shared/config.lua
Config.Phone.RequireItem = true
Config.Phone.ItemName = 'phone'   -- item name in ox_inventory
```

When `RequireItem = false` (default), everyone can use the phone without an inventory item.

## Documentation

Full documentation is available in the `docs/` directory and can be served with VitePress:

```bash
cd docs
npx vitepress dev
```

| Guide | Description |
|-------|-------------|
| [docs/index.md](docs/index.md) | Documentation index |
| [docs/guides/livekit-setup.md](docs/guides/livekit-setup.md) | LiveKit + WebRTC TURN/ICE setup |
| [docs/guides/socket-setup.md](docs/guides/socket-setup.md) | Real-time chat (FiveM native events) |
| [docs/guides/storage-setup.md](docs/guides/storage-setup.md) | Media upload provider setup |
| [docs/guides/adding-app.md](docs/guides/adding-app.md) | How to scaffold a new phone app |
| [docs/guides/framework-bridge.md](docs/guides/framework-bridge.md) | Framework bridge pattern |
| [docs/api/exports.md](docs/api/exports.md) | Full server & client exports reference |
| [docs/api/hooks.md](docs/api/hooks.md) | Hook system for external resources |

## Boot Order

1. `oxmysql`
2. `ox_lib`
3. `qb-core` (or `es_extended`)
4. `gcphone_sounds`
5. `gcphone-next`

## Notifications API

Send notifications from other resources:

```lua
-- Server export
exports['gcphone-next']:SendPhoneNotification(source, {
    appId = 'messages',
    title = 'Messages',
    message = 'New message from Rafa',
    icon = './img/icons_ios/messages.svg',
    priority = 'normal',
    durationMs = 2600,
    route = 'messages',
    data = { conversation = '5551234' }
})

-- Broadcast to all
exports['gcphone-next']:SendPhoneNotification(-1, {
    appId = 'system',
    title = 'Server',
    message = 'Restart in 10 minutes',
    priority = 'high'
})

-- Client export
exports['gcphone-next']:NotifyPhone({
    appId = 'chirp',
    title = 'Chirp',
    message = 'Someone rechirped your post',
    priority = 'normal',
    durationMs = 2600,
})
```

## Hook System

Register hooks from external resources:

```lua
exports['gcphone-next']:registerHook('callStarted', function(payload)
    print('Call started:', payload.phoneNumber)
end, { print = true })
```

Available hooks: `numberDialed`, `callStarted`, `emergencyCallStarted`, `contactAdded`, `contactUpdated`, `contactDeleted`, `messageSent`, `mailAccountCreated`, `phoneSetupCompleted`, `deviceUnlocked`, `imeiViewed`

## Attribution

This repository is a derivative work of [gcphone](https://github.com/manueljlz/gcphone).
All original credits remain with the upstream authors.

## Special Thanks

Gracias Claude AI, ChatGPT, Sora, Kimi, DeepSeek, Nanobanana, Gemini, Copilot, Grok, Mistral, LLaMA, Perplexity, Midjourney, DALL-E, Stable Diffusion, Cursor, Windsurf, Bolt, v0, Replit Agent, Amazon Q, Tabnine y todas las IAs que definitivamente no escribieron ni una sola linea de este codigo. Todo fue hecho a mano, con cafe y mass sufrimiento del necesario.

## License

GPL-3.0 — see [LICENSE.md](LICENSE.md)

---

Maintained by **JericoFX**
