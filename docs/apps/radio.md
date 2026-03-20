---
title: Radio
---

# Radio

![Radio](/img/apps/radio.png)

Live radio stations hosted by players. Hosts create a station, pick a category, play YouTube music via olisound spatial audio, and listeners tune in. Supports private (headphone) and public (spatial) modes.

## Database Tables

None (radio state is held in-memory only).

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:radio:getStations` | Lists all active radio stations |
| `gcphone:radio:createStation` | Creates a new station (name, category, private flag) |
| `gcphone:radio:joinStation` | Joins a station as listener |
| `gcphone:radio:leaveStation` | Leaves a station |
| `gcphone:radio:endStation` | Host ends and destroys the station |
| `gcphone:radio:getStationInfo` | Gets station details and listener count |
| `gcphone:radio:searchMusic` | YouTube search via youtube-sr |
| `gcphone:radio:playMusic` | Host plays a track on the station (olisound) |
| `gcphone:radio:stopMusic` | Host stops current track |
| `gcphone:radio:setMusicVolume` | Adjusts volume and distance |

## Config Options

```lua
Config.Features.Radio = true

Config.Radio = {
    MaxStationNameLength = 50,
    MaxDescriptionLength = 200,
    MaxStationsPerHost = 1,
    Categories = {
        { id = 'music', label = 'Musica', icon = '🎵' },
        { id = 'news', label = 'Noticias', icon = '📰' },
        { id = 'talk', label = 'Talk Show', icon = '🎙️' },
        { id = 'emergency', label = 'Emergencia', icon = '🚨' },
        { id = 'community', label = 'Comunidad', icon = '👥' },
        { id = 'other', label = 'Otro', icon = '📻' },
    },
}
```

## Dependencies

- **olisound** -- required for spatial audio playback
- **youtube-sr** -- YouTube search (included in `server/js/node_modules`, no install needed)
