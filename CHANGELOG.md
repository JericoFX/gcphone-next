# Changelog

All notable changes to gcphone-next will be documented in this file.

## [2.2.0] - 2026-03-19

### Added
- **Streamer Mode** — toggle in Settings > Sound that mutes spatial music/radio from other players. Persisted per-player in database (migration v19). Server-side enforcement via olisound.

### Changed
- **Docs** — removed obsolete Piped API and YouTube Data API key references from music, radio, and getting-started docs. Updated dependencies to reflect bundled youtube-sr and olisound.
- **Docs: getting-started** — added Automated Setup section for `setup-livekit.ps1` wizard (Docker install, config generation, firewall ports, server.cfg convars). Added Native Audio and Open Source sections.

### Removed
- All references to Piped API (`Config.APIs.Piped`) and `gcphone_youtube_api_key` convar from documentation.

## [2.1.0] - 2026-03-19

### Added
- **CityRide** app — Uber-style ride-hailing with fare calculation
- **MatchMyLove** app — Tinder-style dating with swipe, match, and messaging
- **Radio** app — Live player-hosted radio stations with olisound spatial audio
- **Services** app — Professional services directory with ratings
- **ox_inventory** optional phone item requirement (`Config.Phone.RequireItem`)
- **GCPhone namespace** — `GCPhone.State`, `GCPhone.Utils`, `GCPhone.RegisterHook` etc.
- **Config validation** — Safe fallbacks for all Config sections at server init
- **VitePress documentation** — Full docs site with 30+ app docs, API reference, guides
- **GitHub Actions CI** — Automated frontend build, docs deploy, versioned release zip
- **Version check** — Server-side check against latest release on startup
- **About screen** — Shows author and version dynamically from resource metadata

### Changed
- `gcphone_sounds` moved to `[gcphone_sounds]/` bracket folder
- Music and Radio use **olisound** instead of xsound
- README rewritten with current feature list and setup instructions

### Fixed
- Config crash when optional sections are missing from config.lua

## [2.0.0] - 2026-03-01

### Added
- Full SolidJS NUI rewrite
- Modular Lua server architecture
- LiveKit WebRTC video calls
- Socket.IO real-time chat bridge
- Native AWC audio system
- Dark Rooms, Wallet, Documents apps
- NUI auth with token rotation and request signing
- Rate limiting per action/player
- Data retention worker
- Storage provider abstraction
- Hook system for external resources
- QBCore, QBox, and ESX bridge support
