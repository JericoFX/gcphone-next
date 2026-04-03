---
title: Real-Time Chat
---

# Real-Time Chat

gcphone-next uses FiveM native events for all real-time chat functionality. No external Socket.IO server is required.

## How It Works

All chat features use FiveM's built-in event system:
- **Sending:** NUI → `fetchNui()` → Client `RegisterNUICallback` → Server `lib.callback` → oxmysql
- **Receiving:** Server `TriggerClientEvent` → Client `RegisterNetEvent` → NUI `SendNUIMessage` → `useNuiEvent`

No Docker, no ports, no SSL certificates, no JWT secrets. Chat works out of the box.

## Features

| Feature | Persistence | How it works |
|---------|------------|-------------|
| WaveChat Groups | `phone_chat_group_messages` (MySQL) | Messages stored in DB, pushed to group members via `TriggerClientEvent` |
| WaveChat DMs | `phone_wavechat_dm_messages` (MySQL) | Messages stored in DB, pushed to receiver via `TriggerClientEvent` |
| WaveChat Typing | Ephemeral (not stored) | Broadcast to group members or DM target only |
| SnapLive Chat | In-memory only | Broadcast to all players, cleared when stream ends |
| SnapLive Reactions | In-memory only | Broadcast to all viewers |
| MatchMyLove Chat | `phone_matchmylove_messages` (MySQL) | Messages stored in DB, pushed to match partner |
| MatchMyLove Typing | Ephemeral (not stored) | Sent only to match partner |

## Auto-Cleanup

All chat data has automatic retention policies:

| Data | Retention | Mechanism |
|------|----------|-----------|
| WaveChat Group messages | 7 days | Server-side cleanup |
| WaveChat DMs | 14 days, max 50 per conversation | MySQL triggers (auto on INSERT) |
| WaveChat Statuses | 24 hours | Expiry column + cleanup |
| SnapLive Chat | Duration of stream | In-memory, cleared on stream end |
| MatchMyLove messages | 14 days | Server-side cleanup |

## Security

- All chat operations are validated server-side (identifier, group membership, match participation)
- Rate limiting on all send operations (configurable per feature)
- Input sanitization on all text content (strips control characters, enforces max length)
- Messages are only delivered to authorized recipients (group members, DM target, match partner)
- SnapLive moderation (mute/delete) restricted to stream owner
