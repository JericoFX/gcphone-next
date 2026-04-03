---
title: WebRTC & TURN Setup
---

# WebRTC & TURN Setup

gcphone-next uses **native WebRTC** (RTCPeerConnection) for video calls, live streaming (Snap, News), and real-time media. Signaling is handled through FiveM events — no external signaling server required.

## How It Works

- **Signaling:** SDP offers/answers and ICE candidates are relayed through FiveM server events
- **Media:** Peer-to-peer video/audio using native RTCPeerConnection
- **Camera:** Game view captured via WebGL canvas, published as video track
- **No LiveKit, no PeerJS** — zero external media server dependencies

## TURN Server (Required for Reliable Connections)

WebRTC uses ICE to establish peer connections. In most network environments, **STUN** servers (free, public) are sufficient. However, players behind strict NATs or firewalls may need a **TURN** server to relay media.

### Option 1: Cloudflare TURN (Recommended)

Cloudflare offers a free TURN service with generous limits.

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Go to **Calls** > **TURN Keys**
3. Create a TURN key — you'll get:
   - **Turn Token ID** (username)
   - **API Token** (credential)
4. Add to your `shared/config.lua`:

```lua
Config.WebRTC = {
    IceServers = {
        { urls = 'stun:stun.cloudflare.com:3478' },
        {
            urls = 'turn:turn.cloudflare.com:3478?transport=udp',
            username = 'YOUR_TURN_TOKEN_ID',
            credential = 'YOUR_API_TOKEN',
        },
        {
            urls = 'turn:turn.cloudflare.com:443?transport=tcp',
            username = 'YOUR_TURN_TOKEN_ID',
            credential = 'YOUR_API_TOKEN',
        },
    },
}
```

### Option 2: Self-Hosted TURN (coturn)

If you prefer to self-host:

1. Install [coturn](https://github.com/coturn/coturn) on a VPS with a public IP
2. Configure with your domain and TLS certificate
3. Add the TURN URLs to `Config.WebRTC.IceServers`

### Option 3: No TURN (STUN Only)

For local testing or LAN setups, STUN alone is sufficient:

```lua
Config.WebRTC = {
    IceServers = {
        { urls = 'stun:stun.l.google.com:19302' },
        { urls = 'stun:stun.cloudflare.com:3478' },
    },
}
```

This works for most players but may fail for those behind strict corporate/carrier NATs.

## ICE Server Configuration

The server provides ICE servers to the client via the `getWebRTCIceServers` NUI callback. ICE servers are cached client-side for 12 hours to reduce server calls.

## Security

- Peer connections are validated server-side (session ID, channel matching)
- Only authorized peers can connect (allowlist per session)
- Session IDs are 32-character hex strings (cryptographically random)
- Rate limiting on signaling events (500ms window, 60 hits)
- ICE candidates are validated before relay
