---
title: Tools & Scripts
---

# Tools & Scripts

gcphone-next uses Bun for all build and development tooling.

## Web Frontend

The web frontend is built with SolidJS and Vite:

```bash
cd web
bun install
bun run build      # Production build
bun run dev        # Development server
bun run typecheck  # TypeScript check
```

## Server-Side JS

The server-side JavaScript module handles WebRTC ICE server configuration:

```bash
cd server/js
bun install
```

No build step required — FiveM loads the JS files directly.

## Media Uploads

Photos, videos, and audio are uploaded via the configured media provider in `shared/config.lua`. Supported providers:

- **Fivemanage** — cloud-hosted media storage (recommended)
- **Self-hosted** — configure your own upload endpoint

See `Config.Media` in `shared/config.lua` for configuration options.
