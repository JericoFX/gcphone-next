# gcphone-next

FiveM phone resource with SolidJS NUI, Lua server/client modules, LiveKit video-call bridge, and optional Socket.io realtime chat server.

## Quick setup

1) Install SQL schema:

```sql
source sql/schema.sql;
```

Existing database upgrade (Dark Rooms attachments/password/anonymous):

```sql
source sql/migration_20260303_darkrooms_upgrade.sql;
```

2) Install JS bridge dependencies:

```bash
cd server/js
npm install
```

3) Optional realtime socket server dependencies:

```bash
cd socket-server
npm install
```

4) Ensure resource order in `server.cfg`:

```cfg
ensure ox_lib
ensure oxmysql
ensure xsound
ensure gcphone-next
```

## server.cfg convars

Core:

- `setr gcphone_youtube_api_key "your_google_api_key"`
- `setr gcphone_music_piped_api_url "https://pipedapi.kavin.rocks"`
- `setr gcphone_retention_days "7"`
- `setr gcphone_retention_interval_minutes "30"`
- `setr gcphone_feature_wallet "1"`
- `setr gcphone_feature_documents "1"`
- `setr gcphone_feature_darkrooms "1"`
- `setr gcphone_feature_appstore "1"`
- `setr gcphone_feature_music "1"`

LiveKit:

- `setr livekit_host "ws://127.0.0.1:7880"`
- `set livekit_api_key "your_key"`
- `set livekit_api_secret "your_secret"`
- `setr livekit_room_prefix "gcphone"`
- `setr livekit_max_call_duration "300"`

Socket auth token bridge (inside FiveM runtime):

- `setr gcphone_socket_jwt_secret "very_long_random_secret"`

Socket server process (`socket-server/` env vars):

- `PORT` (default `3001`)
- `JWT_SECRET` (must match `gcphone_socket_jwt_secret`)

Recommended socket host convar:

- `setr gcphone_socket_host "ws://127.0.0.1:3001"`

## Storage Providers

`gcphone-next` resolves media upload target from `Config.Storage.Provider` and server convars.

Supported provider ids:

- `fivemanage`
- `server_folder`
- `local`
- `custom`

Default provider examples are defined in `shared/config.lua` under `Config.Storage.KnownProviders`.

### Provider resolution order

For each provider, runtime values are resolved from convars first, then config defaults.

`fivemanage`

- `setr gcphone_storage_fivemanage_url "https://api.fivemanage.com/api/image"`
- `setr gcphone_storage_fivemanage_field "files[]"`

`local`

- `setr gcphone_storage_local_url "http://127.0.0.1:3012/upload"`
- `setr gcphone_storage_local_field "files[]"`

`server_folder`

- `setr gcphone_storage_server_folder_path "cache/gcphone"`
- `setr gcphone_storage_server_folder_public_url "https://cdn.yourdomain.com/gcphone"`
- `setr gcphone_storage_server_folder_encoding "jpg"`
- `setr gcphone_storage_server_folder_quality "0.92"`

`server_folder` stores captures directly on the server disk. Keep retention cleanup active, or storage can fill quickly on busy servers.
Current implementation supports server-folder photo capture path. Video publishing still requires URL-capable upload providers.

`custom`

- `setr gcphone_storage_custom_url "https://your-uploader.example/upload"`
- `setr gcphone_storage_custom_field "files[]"`

Set active provider:

- `Config.Storage.Provider = 'fivemanage'`
- `Config.Storage.Provider = 'server_folder'`
- `Config.Storage.Provider = 'local'`
- `Config.Storage.Provider = 'custom'`

## LiveKit

Server token bridge is in:

- `server/js/livekit.js`
- `server/modules/livekit.lua`

Required convars:

- `setr livekit_host "ws://127.0.0.1:7880"`
- `set livekit_api_key "your_key"`
- `set livekit_api_secret "your_secret"`

Troubleshooting:

- `SDK_NOT_INSTALLED`: run `npm install` in `server/js`.
- `MISSING_CREDENTIALS`: missing `livekit_api_key` or `livekit_api_secret`.
- `TOKEN_ERROR`: verify room format and call participant validation.

## Music App (YouTube + server audio)

Music search is resolved server-side with YouTube Data API so API keys are never exposed to the NUI.

Required convar:

- `setr gcphone_youtube_api_key "your_google_api_key"`

Optional convars:

- `setr gcphone_music_piped_api_url "https://pipedapi.kavin.rocks"`

Notes:

- `gcphone-next` controls playback from the server module and broadcasts 3D audio via `xsound`.
- Keep `xsound` started before `gcphone-next`.
- Search runs server-side, so the Google API key is not exposed to NUI.
- Third-party attribution is documented in `THIRD_PARTY_NOTICES.md`.

## Socket server

Standalone socket server lives in `socket-server/`.

Run:

```bash
cd socket-server
npm install
npm start
```

Env vars:

- `PORT` (default `3001`)
- `JWT_SECRET` (required)

Start command:

```bash
cd socket-server
npm start
```

The socket server validates JWT issued by `server/js/socket_auth.js`.

## Data retention

`gcphone-next` includes a retention worker (`server/modules/retention.lua`) that purges old rows from message/history/social tables.

Defaults:

- Keep data for `7` days.
- Purge job runs every `30` minutes.

Tables covered by default retention:

- `phone_messages`
- `phone_chat_group_messages`
- `phone_calls`
- `phone_chirp_tweets`
- `phone_snap_posts`
- `phone_snap_stories`
- `phone_clips_posts`
- `phone_news`
- `phone_market`
- `phone_darkrooms_posts`
- `phone_darkrooms_comments`

## Dark Rooms

Dark Rooms is asynchronous discussion (forum style), not live chat.

Features:

- optional room password,
- anonymous posts/comments,
- media attachments (image/video/audio URL),
- room posts + threaded comments + voting.

For existing servers, run:

- `sql/migration_20260303_darkrooms_upgrade.sql`

## Wallet + Documents

New core apps included:

- `Wallet` (local balance, cards, transfers)
- `Documents` (ID/license/permit style docs with verification code)

Both are enabled with feature flags by default and use server-side SQL tables.

## App scaffold for external devs

To speed up new app creation with consistent structure:

- `web/src/components/shared/layout/AppScaffold.tsx`
- `web/src/components/apps/_template/TemplateApp.tsx`

`AppScaffold` wraps header/body/footer so external developers can focus on app logic.
