---
title: Socket.IO Setup
---

# Socket.IO Setup

gcphone-next includes an optional Socket.IO integration for real-time chat functionality. This is separate from the standard message system and provides lower-latency communication when enabled.

## What Socket.IO Provides

- Real-time bidirectional communication between the phone NUI and a dedicated chat server
- JWT-authenticated connections (tokens are generated server-side)
- Lower latency for chat messages compared to the standard NUI callback flow

## When to Enable

Socket.IO is **disabled by default** and is entirely optional. Enable it only if:

- You are running a dedicated Socket.IO server alongside your FiveM server
- You want real-time chat features beyond what the default message system provides
- You have the infrastructure to maintain an additional service

If you do not need real-time chat, leave it disabled. The standard message system works without it.

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

## Security Notes

- The JWT secret must remain server-side only (`server.cfg` convars).
- Do not expose the JWT secret in client or web code.
- For production deployments, use `wss://` with TLS.
