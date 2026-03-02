# gcphone-next

FiveM phone resource with SolidJS NUI, Lua server/client modules, LiveKit video-call bridge, and optional Socket.io realtime chat server.

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
- `SQLITE_PATH` (default `./chat.db`)
