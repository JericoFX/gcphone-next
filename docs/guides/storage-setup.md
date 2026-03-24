---
title: Storage & Media Upload
---

# Storage & Media Upload

gcphone-next supports uploading photos, videos, and audio to external providers. All media (camera photos, video recordings, voice messages) uses the same provider configuration.

## Configuration

Add these two convars to your `server.cfg`:

```cfg
set gcphone_provider "fivemanage"
set gcphone_provider_token "YOUR_API_TOKEN"
```

That's it. The token is **never exposed to clients** — it stays server-side and is sent as an HTTP header only when uploading.

## Supported Providers

### Fivemanage (recommended)

Supports images, videos, and audio. Uses the unified v3 API.

1. Create an account at [fivemanage.com](https://fivemanage.com)
2. Go to your dashboard and create an API token
3. Configure:

```cfg
set gcphone_provider "fivemanage"
set gcphone_provider_token "your-fivemanage-api-token"
```

**API details:**
- Endpoint: `POST https://api.fivemanage.com/api/v3/file`
- Auth: `Authorization: <token>` header
- Field: `file`
- Response: `{ "data": { "url": "https://r2.fivemanage.com/..." }, "status": "ok" }`

References:
- [Fivemanage Image Upload Docs](https://docs.fivemanage.com/guides/uploading-files/images)
- [Fivemanage Video Upload Docs](https://docs.fivemanage.com/guides/uploading-files/videos)

### Discord Webhook

Supports images and videos. Not recommended for production (rate limits, no audio support).

1. Create a webhook in your Discord server (Server Settings → Integrations → Webhooks)
2. Copy the webhook URL
3. Configure:

```cfg
set gcphone_provider "discord"
set gcphone_provider_token "https://discord.com/api/webhooks/XXXX/YYYY"
```

### Custom Provider

Any HTTP endpoint that accepts multipart file uploads.

```cfg
set gcphone_provider "custom"
set gcphone_provider_token "https://your-api.com/upload"
```

The file is sent as a `file` field in a `multipart/form-data` POST request. The response should contain a `url`, `data.url`, or `link` field with the public URL.

### Server Folder (images only)

Saves screenshots to the server filesystem using `screenshot-basic`. Does **not** support video or audio.

```cfg
set gcphone_provider "server_folder"
```

Requires additional configuration in `shared/config.lua`:

```lua
Config.Storage = {
    ServerFolder = {
        Path = 'cache/gcphone',
        PublicBaseUrl = 'https://your-server.com/gcphone/',
        Encoding = 'jpg',   -- jpg, png, webp
        Quality = 0.92,
    },
}
```

Also requires the `screenshot-basic` resource to be running.

## How It Works

```
Player takes photo/video/voice message
    ↓
NUI asks server for upload config (URL + headers)
    ↓
Server reads convars, builds config with auth headers
    ↓
NUI uploads file directly to provider API
    ↓
Provider returns public URL
    ↓
URL is stored in the database
```

The token never appears in client-side code. It is only used server-side to build the `Authorization` header, which is then passed to the NUI for the direct upload.

## Media Types

| Type | Used by | File format |
|------|---------|-------------|
| Image | Camera, Gallery, Snap, Chirp, Clips | webp, jpg, png |
| Video | Camera (video mode), Clips | webm (vp9+opus) |
| Audio | Messages (voice), WaveChat (voice) | webm (opus) |

## Upgrading from Previous Versions

If you are upgrading from a version that stored audio as base64 in the database:

1. Run `sql/drop_all.sql` to drop all gcphone tables
2. Run `sql/schema.sql` to recreate them with the updated schema
3. **This will delete all existing phone data.** Back up first if needed.

The `audio_data` column is now `VARCHAR(500)` (URL) instead of `MEDIUMTEXT` (base64), significantly reducing database size.
