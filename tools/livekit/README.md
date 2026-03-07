# LiveKit self-host quickstart (gcphone)

This folder provides a ready setup for hosting your own LiveKit server for gcphone.

## Trust reminder

- Download and run these scripts only from this repository's GitHub.
- If you do not trust scripts, follow the manual steps below and inspect `setup-livekit.ps1` before using it.

## Requirements

- Docker + Docker Compose
- Open firewall ports on your host:
  - TCP `7880` (LiveKit signal / WebSocket)
  - TCP `7881` (RTC TCP fallback)
  - UDP `50000-50100` (RTC media)

## No Docker?

- Node.js is only used here to sign tokens in gcphone server code.
- Node.js cannot replace a LiveKit media server (SFU).
- If you do not want Docker, install and run `livekit-server` binary manually (and Redis for non-dev mode).
- For quick local tests, LiveKit supports `livekit-server --dev`.

## First-time setup (Windows)

1. Run `setup-livekit.bat`
   - If Docker is missing, the script asks if you want to open Docker Desktop download page.
2. Answer the prompts (host, ports, api key/secret, etc.)
3. The setup generates:
   - `.env`
   - `livekit.yaml`
   - `start-livekit.bat`
   - `stop-livekit.bat`

## Manual setup (no script)

If you prefer to do it manually, this is what `setup-livekit.ps1` does:

1. Create `tools/livekit/.env` with values:

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

2. Create `tools/livekit/livekit.yaml`:

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

3. Start stack manually:

docker compose --env-file .env -f docker-compose.yml up -d

4. Add convars in `server.cfg`:

setr livekit_host "ws://YOUR_SERVER_IP:7880"
setr livekit_api_key "YOUR_KEY"
setr livekit_api_secret "YOUR_SECRET"
setr livekit_room_prefix "gcphone"
setr livekit_max_call_duration "300"

## Start / stop

- Start: `start-livekit.bat`
- Stop: `stop-livekit.bat`

## FiveM convars

Copy the values printed by the setup script into your server config:

setr livekit_host "ws://YOUR_SERVER_IP:7880"
setr livekit_api_key "YOUR_KEY"
setr livekit_api_secret "YOUR_SECRET"
setr livekit_room_prefix "gcphone"
setr livekit_max_call_duration "300"

These credentials must stay server-side only. Do not put API key/secret in client/web runtime code.

## Notes

- `ws://127.0.0.1:7880` only works locally.
- For internet/public production you should move to `wss://` with TLS.
- TURN/TLS can be enabled from the setup script when you have domain + cert files.
