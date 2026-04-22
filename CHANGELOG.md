# Changelog

All notable changes to gcphone-next will be documented in this file.

## [3.1.6] - 2026-04-21

### Fixed
- `server/modules/phone_drop.lua`: persisted phone drops now wait for `MySQL.ready` before rehydrating — oxmysql may not have finished its handshake when the module is required, silently dropping the SELECT on cold start
- `server/modules/darkrooms.lua`, `server/modules/retention.lua`, `server/modules/database.lua`, `server/bridge/esx.lua`: DB init gated on `MySQL.ready` instead of magic `Wait(N)` delays that raced oxmysql on slow first boot
- `server/modules/calls.lua`, `client/calls.lua`: pma-voice detection is re-evaluated per call via `IsUsingPmaVoice()` instead of a boolean cached at module load, so a later `/start pma-voice` is picked up without a gcphone restart
- `server/modules/phone_drop.lua`: ox_inventory `swapItems` hook re-registers on `ox_inventory` restart; previously a single top-level registration was lost whenever the inventory resource cycled
- `client/main.lua`: `gcphone:init` payload is buffered until the NUI signals `nuiReady`, preventing a blank phone on cold connect when the SolidJS mount raced the first SendNUIMessage
- `server/modules/calls.lua`: active calls are reset on `onResourceStop` (pma-voice channels cleared, incoming-call state bags cleared, accepted calls persisted), eliminating phantom voice channels after `/restart gcphone`
- `server/modules/phone.lua`: qbx_core servers now receive `gcphone:init` on fresh join — the handler for the legacy `QBCore:Server:PlayerLoaded` event was the only path, missing qbx_core's `QBCore:Server:OnPlayerLoaded` (verified via qbox-docs)
- `server/modules/wavechat_dm.lua`: `CREATE TABLE` / `ALTER TABLE` migrations now run inside `MySQL.ready` with `ADD COLUMN IF NOT EXISTS`, same race class as above

### Changed
- Dropped-phone broadcast now flows through `GlobalState.gcphone_drops` instead of `gcphone:phoneDropped` / `gcphone:phonePickedUp` net events plus a `Wait(500) + lib.callback` bootstrap; clients subscribe with `AddStateBagChangeHandler`. `gcphone:getDroppedPhones` callback removed — late-joining clients read the bag directly
- Active calls are published as a minimal snapshot under `GlobalState.gcphone_active_calls` so external resources can observe call state without the `GetActiveCalls` export hop
- `server/modules/garage.lua`, `server/modules/mail.lua`, `server/modules/sdk.lua`, `server/modules/wallet.lua`: notification / receipt `pcall` wrappers capture the error and `warn()` it instead of swallowing silently, so regressions become visible during dev

### Added
- `scripts/lint-antipatterns.sh` — static check for the three bug classes fixed in this release (top-level `MySQL.await`, cached `GetResourceState`, `CreateThread + Wait + lib.callback` bootstrap). Wired into CI as the `lint-antipatterns` job gating the build. Opt-in pre-commit hook under `.githooks/pre-commit` (enable with `git config core.hooksPath .githooks`)
- `.gitattributes` pins `*.sh` and `.githooks/*` to LF so commits from Windows do not ship CRLF to the Linux CI runner

## [3.1.5] - 2026-04-21

### Changed
- Node runtime deps moved from `server/js/` to resource root: run `npm install` (or bun / yarn / pnpm install) at the resource root instead of inside `server/js/`
- `server/js/youtube_search.js` resolves `node_modules` via `GetResourcePath` against the root
- Release zip now ships root `package.json` and `package-lock.json` so a fresh install from the zip works end-to-end

### Removed
- `server/js/livekit.js` and `livekit-server-sdk` / `jsonwebtoken` dependencies — LiveKit has been superseded by native WebRTC since 3.1.0; the SDK-based token generator is no longer used
- Stale LiveKit warning block in `server/init.lua`

## [3.1.4] - 2026-04-21

### Fixed
- Phone init race on connect: client no longer fires `lib.callback('gcphone:getPhoneData')` on a fixed 1s timer (raced server module load and fired before character select in multichar)
- Multichar character-load: client now listens to `esx:playerLoaded` and `QBCore:Client:OnPlayerLoaded` to fetch phone data once the character is actually loaded
- `/restart gcphone` with players already online: server now rehydrates every connected player via `onResourceStart`, waiting for the framework bridge before pushing `gcphone:init`

### Removed
- `Config.Startup.ClientInitDelayMs` (orphan after dropping the fixed-timer pull)

## [3.1.3] - 2026-04-20

### Fixed
- PIN setup prompt: `ResolveSetupState` now requires `pin_hash` so legacy phones with `is_setup=1` but no PIN get re-prompted; `phone_numbers.is_setup` default changed from `1` to `0`
- Handle validation: client `isValidHandle` and server `SafeUsername` accept trailing `._-` (e.g. `jericofx_`)
- SQL triggers: unified delimiter from `$` to `//` in `trg_wavechat_dm_cap` and `trg_wavechat_dm_expire` for MariaDB compatibility
- Phone camera: `ClearPedTasks` on advanced camera entry so the ped's hand/phone prop no longer appears in frame
- Release zip: `sql/` and `version.txt` are now bundled, fixing the resource reporting `0.0.0` and spamming "new version available"

### Changed
- `fxmanifest.lua` now ships `sql/schema.sql` and `sql/upgrades/*.sql` via the `files` block
- `web/src/store/phone.tsx` wraps multi-`setState` sites in `batch()` (hide, refreshSetupState, completeSetup, ringtones, screen lock toggle, moveApp)

## [3.1.2] - 2026-04-14

### Added
- **Home screen folders** — iOS-style drag-to-merge folders with a limit of 4 folders per device and 4 apps per folder
- Folder modal with color picker (8 colors), rename and delete actions; animated open/close with shared transform origin
- Server-side layout normalizer mirroring the client validation: folders, pinned apps, enabled-app filtering and 16KB payload ceiling
- Optimistic concurrency on `phone_layouts` via a new `version` column; conflicts reconcile the client to the latest server layout
- Per-source rate-limit (1.5s) on `setAppLayout` to blunt spam/DoS
- Client-side 400ms debounced persistence for layout mutations
- SQL upgrade `sql/upgrades/opt-folders-v2.sql` adding the `version` column

### Changed
- `gcphone:getAppLayout` now returns `{ layout, version }`
- `gcphone:setAppLayout` now returns `{ ok, version, layout?, reason? }` with structured error reasons (`version_conflict`, `rate_limited`, `too_large`, …)
- `NormalizeLayout` in `server/modules/phone_layouts.lua` processes folders, pinned ordering and default fill-in as a single pipeline
- Docs: new `guides/home-folders.md`, updated `api/callbacks.md` and `api/nui-callbacks.md` to reflect the new contract

## [3.1.1] - 2026-04-13

### Changed
- Split `server/modules/phone.lua` into `phone_layouts.lua` and `phone_settings.lua`
- Split `server/modules/snap.lua`, extracting live logic into `snap_live.lua`
- Split `client/nui_bridge.lua` per domain into `client/nui/{events,darkrooms,radio,cityride}.lua`
- Break `MessagesApp`, `ChirpApp` and `NewsApp` into dedicated modal/view sub-components

### Added
- Database indexes on `phone_messages`, `phone_calls` and `phone_social_notifications` (+ upgrade script in `sql/upgrades/opt-12-perf-indexes.sql`)
- `Config.Startup`, `Config.SDK` and `Config.Callbacks` sections in `shared/config.lua`
- `@apps/*` path alias for `web/src/components/apps/*`
- Startup log listing active entries in `Config.Phone.ExportAllowlist`

### Fixed
- Sync `fxmanifest.lua` version with `version.txt` (was stuck at `2.10.0`)

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
