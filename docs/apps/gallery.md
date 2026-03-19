---
title: Gallery
---

# Gallery

Photo and video gallery stored per player. Supports saving, deleting, setting photos as wallpaper, and NFC proximity sharing.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_gallery` | Media entries -- identifier, url, type (image/video), created_at |
| `phone_numbers` | Write -- updates `wallpaper` column when setting photo as wallpaper |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:getGallery` | Returns all gallery media for the player, newest first |
| `gcphone:savePhoto` | Saves a new photo/video URL to the gallery |
| `gcphone:deletePhoto` | Deletes a gallery item |
| `gcphone:setPhotoAsWallpaper` | Sets a gallery photo as the phone wallpaper |
| `gcphone:gallery:shareNfc` | Shares a photo with a nearby player via proximity (distance check) |

## Config Options

```lua
Config.Gallery = {
    MaxPhotos      = 100,
    MaxPhotoSize   = 5242880,
    AllowedFormats = { 'jpg', 'jpeg', 'png', 'gif', 'webp' },
}

Config.Proximity.SharePhotoDistance = 3.0
```

## Exports

| Export | Signature | Purpose |
|---|---|---|
| `GetGallery` | `(identifier, requestSource) -> table[]` | Returns gallery media (access-checked) |
