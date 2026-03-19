---
title: Music
---

# Music

Spatial music player using olisound. Searches YouTube via the API, resolves audio streams through Piped, and plays them as 3D positional audio that nearby players can hear.

## Database Tables

None (music state is held in-memory only).

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:music:searchCatalog` | Searches YouTube for videos matching a query |
| `gcphone:music:searchITunes` | Alias for `searchCatalog` |
| `gcphone:music:canSearchCatalog` | Checks if a YouTube API key is configured |

## Net Events (Server)

| Event | Purpose |
|---|---|
| `gcphone:music:play` | Resolves and plays a YouTube video or direct URL as spatial audio |
| `gcphone:music:pause` | Pauses the current track |
| `gcphone:music:resume` | Resumes the current track |
| `gcphone:music:stop` | Stops and destroys the current sound |
| `gcphone:music:setVolume` | Updates volume and distance for the current track |

## Client Events

| Event | Purpose |
|---|---|
| `gcphone:music:playFromNUI` | NUI bridge to trigger server play |
| `gcphone:music:pauseFromNUI` | NUI bridge to trigger server pause |
| `gcphone:music:resumeFromNUI` | NUI bridge to trigger server resume |
| `gcphone:music:setState` | Server -> Client state sync (playing, paused, title, etc.) |

## Config Options

```lua
Config.Features.Music = true

Config.Music = {
    Enabled                = true,
    DefaultVolume          = 0.15,
    DefaultDistance         = 15.0,
    MaxDistance             = 30.0,
    MaxResults             = 12,
    UpdatePositionInterval = 300,  -- ms between position updates
}

Config.APIs.Piped = {
    Enabled = true,
    BaseUrl = 'https://piped.video',
}
```

## Dependencies

- **olisound** -- required for spatial audio playback
- YouTube Data API key (convar `gcphone_youtube_api_key`) -- required for search
- Piped API -- required for resolving audio streams

## Exports

None.
