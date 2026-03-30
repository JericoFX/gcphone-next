---
title: Socket.IO Setup
---

# Socket.IO Setup

gcphone-next uses a Socket.IO server for all real-time chat functionality. This is a **required** component -- WaveChat, SnapLive, and MatchMyLove depend on it and have no fallback.

## What Socket.IO Provides

- Real-time bidirectional communication between the phone NUI and the chat server
- JWT-authenticated connections (tokens are generated server-side)
- WaveChat group chat with typing indicators and message persistence
- SnapLive streaming chat with reactions, viewer counts, and moderation
- MatchMyLove real-time dating chat between matched players
- Per-identifier rate limiting that persists across reconnections

## Dependencies

The Socket.IO server requires Node.js and the following npm packages:

- **socket.io** `^4.8.1` -- WebSocket server
- **jsonwebtoken** `^9.0.2` -- JWT authentication

### Installation

```bash
cd socket-server
npm install
```

This installs all dependencies listed in `socket-server/package.json`. You **must** run this before starting your FiveM server.

> **Important:** If you skip this step, the Socket.IO server will fail to start with module-not-found errors. All real-time chat features (WaveChat, SnapLive, MatchMyLove) will be non-functional.

## Config.lua

Socket.IO is controlled in `shared/config.lua`:

```lua
Config.Socket = {
    Enabled = false,  -- Set to true to enable
}
```

## server.cfg Convars

When Socket.IO is enabled, add these convars to your `server.cfg`:

```cfg
setr gcphone_socket_host "ws://YOUR_SERVER_IP:3001"
setr gcphone_socket_jwt_secret "YOUR_JWT_SECRET"
```

### Convar Details

| Convar | Description |
|---|---|
| `gcphone_socket_host` | WebSocket URL of your Socket.IO server. Must start with `ws://` or `wss://`. |
| `gcphone_socket_jwt_secret` | JWT secret used to sign authentication tokens. Must match the secret configured on your Socket.IO server. |

## Authentication Flow

1. When a player connects, the gcphone server-side JavaScript (`server/js/socket_auth.js`) generates a JWT token using the configured secret.
2. The token is passed to the NUI client.
3. The NUI client uses the token to authenticate with the Socket.IO server.
4. The Socket.IO server validates the token before accepting the connection.

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `MISSING_SOCKET_HOST` in server console | `gcphone_socket_host` convar is not set |
| `INVALID_SOCKET_HOST_SCHEME` | `gcphone_socket_host` does not start with `ws://` or `wss://` |
| Connection refused | Verify the Socket.IO server is running and the port is accessible |
| Authentication failures | Ensure `gcphone_socket_jwt_secret` matches the secret on your Socket.IO server |

## Starting the Socket.IO Server

The Socket.IO server runs as a standalone Node.js process alongside your FiveM server:

```bash
cd socket-server
JWT_SECRET="your-secret-here" node index.js
```

Or set environment variables:

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | JWT signing secret (min 16 characters). Must match `gcphone_socket_jwt_secret` in `server.cfg`. |
| `PORT` | No | Port to listen on (default: `3001`). |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (default: `*`). |

The server will exit with an error if `JWT_SECRET` is missing or shorter than 16 characters.

## Features Powered by Socket.IO

When enabled, the Socket.IO server handles real-time communication for:

| Feature | Description |
|---|---|
| **WaveChat** | Group chat rooms with typing indicators, message persistence, and media sharing |
| **SnapLive** | Live streaming chat with reactions, viewer counts, and moderation (mute/delete) |
| **MatchMyLove** | Dating app real-time chat between matched players |

All features include per-identifier rate limiting that persists across reconnections.

## Security Notes

- The JWT secret must remain server-side only (`server.cfg` convars).
- Do not expose the JWT secret in client or web code.
- For production deployments, use `wss://` with TLS.
