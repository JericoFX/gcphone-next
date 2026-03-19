---
title: LiveKit Setup
---

# LiveKit Setup

LiveKit provides the WebRTC backend for video calls in gcphone-next. It runs as a self-hosted SFU (Selective Forwarding Unit) via Docker, with gcphone's server-side JavaScript bridge generating authentication tokens.

## What LiveKit Provides

- WebRTC video and audio calls between players
- Server-side token signing (API keys never reach the client/NUI)
- Room management with configurable call duration limits
- NAT traversal via STUN/TURN

## Requirements

- **Docker + Docker Compose** on the machine hosting LiveKit
- Firewall ports open on the host:
  - **TCP 7880** -- LiveKit signal / WebSocket
  - **TCP 7881** -- RTC TCP fallback
  - **UDP 50000-50100** -- RTC media

If you do not want Docker, you can install the `livekit-server` binary directly and run Redis separately. For quick local testing, LiveKit supports `livekit-server --dev` mode.

## Setup Scripts

The repository includes ready-made setup scripts in `tools/livekit/`:

| File | Purpose |
|---|---|
| `setup-livekit.bat` | Interactive setup -- generates `.env`, `livekit.yaml`, and prints server.cfg convars |
| `start-livekit.bat` | Start the Docker Compose stack |
| `stop-livekit.bat` | Stop the Docker Compose stack |
| `setup-livekit.ps1` | PowerShell version of the setup script |
| `docker-compose.yml` | Compose file for LiveKit + Redis |
| `livekit.template.yaml` | Template for LiveKit server config |

### First-Time Setup (PowerShell — recommended)

The **PowerShell setup wizard** is the recommended way to configure LiveKit. It prompts for every option interactively, including optional TURN/TLS.

```powershell
powershell -ExecutionPolicy Bypass -File tools\livekit\setup-livekit.ps1
```

The wizard asks for:

| Prompt | Default | Notes |
|---|---|---|
| Connection scheme (`ws` / `wss`) | `ws` | Use `wss` for production with TLS |
| Public host IP / domain | `127.0.0.1` | Must be reachable by FiveM clients |
| Signal/WebSocket port | `7880` | TCP |
| RTC TCP port | `7881` | Fallback for UDP-blocked clients |
| RTC UDP range start | `50000` | Media ports |
| RTC UDP range end | `50100` | Media ports |
| `use_external_ip` | `yes` | Required for non-localhost |
| API key | `gcphone` | Shared between LiveKit and FiveM |
| API secret | auto-generated | 48-char random token if left empty |
| Room prefix | `gcphone` | Prevents room collisions |
| Max call duration (seconds) | `300` | 30–86400 |
| Enable TURN/TLS | `no` | For strict NAT / production |
| TURN domain, port, cert, key | — | Only if TURN enabled |

After completing the wizard, it generates:

- `tools/livekit/.env` — environment variables for Docker Compose
- `tools/livekit/livekit.yaml` — LiveKit server configuration
- `tools/livekit/start-livekit.bat` — Docker Compose up script
- `tools/livekit/stop-livekit.bat` — Docker Compose down script

It also prints the exact `server.cfg` convars to copy.

### Alternative: BAT Setup

If you prefer the basic `.bat` version:

```
tools\livekit\setup-livekit.bat
```

This has the same flow but runs in `cmd`. If Docker is not installed, it offers to open the Docker Desktop download page.

### Manual Setup

If you prefer not to use the interactive script:

1. Create `tools/livekit/.env`:

   ```env
   LIVEKIT_HOST=ws://YOUR_SERVER_IP:7880
   LIVEKIT_WS_PORT=7880
   LIVEKIT_RTC_TCP_PORT=7881
   LIVEKIT_RTC_PORT_RANGE_START=50000
   LIVEKIT_RTC_PORT_RANGE_END=50100
   LIVEKIT_API_KEY=YOUR_KEY
   LIVEKIT_API_SECRET=YOUR_SECRET
   LIVEKIT_ROOM_PREFIX=gcphone
   LIVEKIT_MAX_CALL_DURATION=300
   LIVEKIT_USE_EXTERNAL_IP=true
   LIVEKIT_TURN_TLS_ENABLED=false
   ```

2. Create `tools/livekit/livekit.yaml`:

   ```yaml
   port: 7880
   log_level: info
   rtc:
     tcp_port: 7881
     port_range_start: 50000
     port_range_end: 50100
     use_external_ip: true
   redis:
     address: redis:6379
   keys:
     'YOUR_KEY': 'YOUR_SECRET'
   turn:
     enabled: false
   ```

3. Start the stack:

   ```bash
   cd tools/livekit
   docker compose --env-file .env -f docker-compose.yml up -d
   ```

## Docker Compose Stack

The provided `docker-compose.yml` runs two services:

- **redis** -- Redis 7 Alpine, used by LiveKit for room state
- **livekit** -- Latest LiveKit server image, configured via `livekit.yaml`

## server.cfg Convars

Add these to your FiveM `server.cfg`:

```cfg
setr livekit_host "ws://YOUR_SERVER_IP:7880"
setr livekit_api_key "YOUR_KEY"
setr livekit_api_secret "YOUR_SECRET"
setr livekit_room_prefix "gcphone"
setr livekit_max_call_duration "300"
```

- `livekit_host` must begin with `ws://` or `wss://`.
- `livekit_api_key` and `livekit_api_secret` are **server-side only**. Never put them in client or web code.
- `livekit_room_prefix` is prepended to room names to avoid collisions if you run multiple resources.
- `livekit_max_call_duration` is in seconds (default 300 = 5 minutes).

## Config.lua

LiveKit is also controlled by `shared/config.lua`:

```lua
Config.LiveKit = {
    Enabled = true,
    MaxCallDurationSeconds = 300,
}
```

Set `Enabled = false` to disable LiveKit entirely (calls will still work without video via the basic WebRTC path if `Config.Calls.UseWebRTC` is true).

## Networking Notes

- `ws://127.0.0.1:7880` only works for local testing. For production, use a reachable IP or domain.
- For public/internet deployments, use `wss://` with TLS certificates.
- STUN-only setups can fail in strict NAT or corporate firewall environments. For production reliability, configure TURN with TLS.
- The TURN/TLS option is available in the interactive setup script.

## Start and Stop

```bash
# Start
tools\livekit\start-livekit.bat

# Stop
tools\livekit\stop-livekit.bat
```

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `MISSING_HOST` in server console | `livekit_host` convar is not set |
| `INVALID_HOST_SCHEME` | `livekit_host` does not start with `ws://` or `wss://` |
| 401 error on token generation | API key or secret does not match the LiveKit server config |
| Setup script closes immediately | Run from `cmd` (not double-click) to see the error output |
| Calls connect but no audio/video | Check that UDP 50000-50100 is open on the host firewall |
| Works locally but not remotely | Replace `127.0.0.1` with your public IP or domain |

## Security

- Download setup scripts only from this repository.
- Keep `livekit_api_key` and `livekit_api_secret` in `server.cfg` only.
- Do not hardcode LiveKit credentials in web or client files.
- Inspect `setup-livekit.ps1` before running if you want to verify what it does.
