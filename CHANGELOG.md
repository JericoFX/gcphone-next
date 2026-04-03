# Changelog

All notable changes to gcphone-next will be documented in this file.

## [3.1.0] - 2026-04-02

### Added
- **Native WebRTC** — replaced LiveKit with peer-to-peer RTCPeerConnection for video calls and live streaming. Signaling via FiveM events, no external media server required.
- **useLiveCamera** SolidJS hook — shared WebRTC camera management for Snap and News apps
- **Camera first-person mode** — enter first-person view during camera capture
- **Phone prop visibility** — hide phone prop in rear camera mode, dynamic visibility toggle on selfie switch
- **iOS 18 flashlight slider** — vertical glass-morphism slider replacing the old toggle
- **Music playlist selector** — multi-playlist support with modal picker and create-new option
- **Force-close cleanup** — SnapApp and NewsApp properly clean up live streams on multitask force-close

### Changed
- Auto-clear search results after track selection in Music app
- Documentation fully corrected: removed all LiveKit/Socket.IO server references, updated to native WebRTC architecture
- Build workflow cleaned: removed socket-server and tools packaging from GitHub Actions

### Removed
- `socket-server/` directory and all Socket.IO server code
- `tools/livekit/` directory and LiveKit tooling
- LiveKit convars (`livekit_host`, `livekit_api_key`, `livekit_api_secret`, `livekit_room_prefix`, `livekit_max_call_duration`)
- `Config.LiveKit` configuration section

### Fixed
- Walk mode toggle now has cooldown and camera mode protection
- Phone NUI focus state respects walk mode

## [3.0.0] - 2026-04-01

### Changed
- **DX audit** — 32 bug fixes across the entire codebase
- SolidJS standardization: consistent patterns, shared utilities
- Developer documentation added

## [2.10.0] - 2026-04-01

### Added
- **Phone UI SDK** — standardized component library for phone apps
- **Permissions system** — per-app permission management
- **WaveChat DM separation** — direct messages split from group Messages into WaveChat

## [2.9.5] - 2026-03-31

### Changed
- Documentation updated: Socket.IO requirements, dependency install guides, tools-scripts docs

## [2.9.4] - 2026-03-31

### Fixed
- QBox export API compatibility
- Missing `SetFrameworkPhoneNumber` in QB bridge

## [2.9.3] - 2026-03-30

### Added
- **Icon shapes** — customizable app icon shapes in Settings > Display
- **Widget picker** — full-screen iOS-style modal with search and accordion layout
- **Widgets** — weather, bank, gallery, radio widget types with live content rendering
- i18n security hardening

### Changed
- HomeScreen rewritten as slim orchestrator with sub-components (AppGrid, WidgetPage, FolderModal, WidgetCard, etc.)
- Pointer-event drag-and-drop with folder merge support

## [2.9.2] - 2026-03-25

### Added
- Startup banner with version info
- Complete i18n for all 8 languages
- Phone store API documentation

## [2.9.1] - 2026-03-25

### Fixed
- Memory leaks fixed across 15 files

## [2.9.0] - 2026-03-24

### Added
- **Dynamic Island** with live activities for 7 app types
- **13 new features**: page transitions, customization options, focus modes, playlists, CarPlay mode, MiniApp framework
- Phone size slider in Settings (70%-100% scale)
- All TypeScript errors resolved

### Changed
- Radio app redesigned with Apple Music aesthetic
- Settings app redesigned to iOS 18 style with dark/light mode in setup

## [2.8.2] - 2026-03-24

### Fixed
- Tap-to-unlock z-index
- Control Center tile sizes

## [2.8.1] - 2026-03-23

### Removed
- Dead color-mix polyfill and postcss plugin

### Fixed
- YouTube-sr require path
- i18n for Chirp hardcoded strings

## [2.8.0] - 2026-03-23

### Added
- **@motionone/solid** animations for shared UI components
- Flashlight brightness slider in Control Center
- Radio mock callbacks for browser dev mode
- i18n for Radio (8 keys), MatchMyLove (47 strings), WaveChat (22 keys), Chirp

### Changed
- LockScreen redesigned to iOS 18 style
- Control Center and Notification Center redesigned to iOS 18 style
- Settings redesigned with profile banner and solid icons
- SnapApp split into sub-components (FeedTab, DiscoverTab, ProfileTab, LiveViewerOverlay)
- WaveChat split into 4 sub-components
- Swipe-to-unlock replaced with tap-to-unlock when no PIN set

### Fixed
- WebGL camera rendering
- Removed all `color-mix()` CSS (unsupported in FiveM NUI)
- Snap infinite recursion bug
- Camera controls restricted to canvas-only (no game camera manipulation)
- Lockscreen backdrop-filter removed, PIN hidden when not set
- Camera cursor properly hidden during camera mode

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
- Native AWC audio system
- Dark Rooms, Wallet, Documents apps
- NUI auth with token rotation and request signing
- Rate limiting per action/player
- Data retention worker
- Storage provider abstraction
- Hook system for external resources
- QBCore, QBox, and ESX bridge support
