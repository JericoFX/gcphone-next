# LiveKit self-host quickstart (gcphone)

This folder provides a ready setup for hosting your own LiveKit server for gcphone.

## Requirements

- Docker + Docker Compose
- Open firewall ports on your host:
  - TCP `7880` (LiveKit signal / WebSocket)
  - TCP `7881` (RTC TCP fallback)
  - UDP `50000-50100` (RTC media)

## First-time setup (Windows)

1. Run `setup-livekit.bat`
2. Answer the prompts (host, ports, api key/secret, etc.)
3. The setup generates:
   - `.env`
   - `livekit.yaml`
   - `start-livekit.bat`
   - `stop-livekit.bat`

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

## Notes

- `ws://127.0.0.1:7880` only works locally.
- For internet/public production you should move to `wss://` with TLS.
- TURN/TLS can be enabled from the setup script when you have domain + cert files.
