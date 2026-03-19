---
title: gcphone-next
---

# gcphone-next

**gcphone-next** is a modernized FiveM phone resource built with SolidJS for the NUI layer and Lua for client/server logic. It uses ox_lib and oxmysql as its foundation libraries, and integrates LiveKit for WebRTC video calls and Socket.IO for optional real-time chat.

This project is a fork of [gcphone](https://github.com/manueljlz/gcphone) by manueljlz, restructured with a modular architecture, a fully rewritten frontend, and many new features.

## Features

gcphone-next ships with 27+ built-in apps:

| Category | Apps |
|---|---|
| **Communication** | Contacts, Messages, Calls, WaveChat (group chat), Mail |
| **Social** | Chirp (Twitter-like), Snap (Instagram-like), Clips (TikTok-like), News |
| **Utilities** | Gallery, Camera, Flashlight, Notes, Clock, Weather, Maps, Notifications |
| **Finance** | Bank, Wallet |
| **Services** | Garage, Yellow Pages, Market, Documents |
| **Community** | Dark Rooms (anonymous forum), Music (YouTube search + proximity playback) |
| **System** | Proximity sharing, Location tracking, Phone drop/pickup |

Additional capabilities:

- Native audio system with customizable ringtones, notification tones, and message tones
- Phone setup wizard with PIN lock
- Configurable phone number format and prefixes
- Storage provider abstraction (FiveManage, server folder, local uploader, custom URL)
- Data retention system with SQL-based automatic cleanup
- Notification API for external resources (server and client exports)
- App scaffold for developers to add custom apps
- ox_inventory item check support (optional)

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Lua 5.4 (FiveM Cerulean) |
| NUI Frontend | SolidJS + TypeScript + Vite |
| Styling | SCSS Modules (iOS 18 design system) |
| Libraries | ox_lib, oxmysql |
| Video Calls | LiveKit (self-hosted WebRTC SFU) |
| Real-time Chat | Socket.IO (optional) |
| Database | MySQL/MariaDB via oxmysql with auto-migrations |
| Package Manager | Bun (for web build) |

## Framework Support

gcphone-next supports multiple FiveM frameworks through a bridge pattern:

- **QBCore** (`qb-core`)
- **QBox** (`qbx_core`)
- **ESX** (`es_extended`)

The active framework is set via `Config.Framework` in `shared/config.lua`. Only one bridge loads at runtime.

## Documentation Sections

- [Getting Started](/getting-started) -- Installation, configuration, and first boot
- [Adding an App](/guides/adding-app) -- How to scaffold a new phone app
- [LiveKit Setup](/guides/livekit-setup) -- Self-host WebRTC video calls
- [Socket.IO Setup](/guides/socket-setup) -- Optional real-time chat server
- [Framework Bridge](/guides/framework-bridge) -- How the framework abstraction works

## Requirements at a Glance

- FiveM server build 5181 or newer
- OneSync enabled
- ox_lib
- oxmysql
- gcphone_sounds (audio bank resource)
- A supported framework (QBCore, QBox, or ESX)
