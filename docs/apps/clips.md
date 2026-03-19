---
title: Clips
---

# Clips (TikTok-like)

Short video sharing app. Uses the Snap account system for identity but supports a separate `clips_username` stored in `phone_numbers`.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_clips_posts` | Video posts -- account_id, media_url, caption, likes |
| `phone_clips_likes` | Like relationships (clip_id, account_id) |
| `phone_clips_comments` | Comments on clips (clip_id, account_id, content) |
| `phone_snap_accounts` | Shared account system (used for identity) |
| `phone_numbers` | Read -- `clips_username` column |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:clips:getFeed` | Returns the global clips feed with pagination |
| `gcphone:clips:getMyClips` | Returns the caller's own clips |
| `gcphone:clips:publish` | Publishes a new video clip (requires clips_username and storage provider) |
| `gcphone:clips:deletePost` | Deletes own clip |
| `gcphone:clips:toggleLike` | Likes or unlikes a clip (uses DB transaction for atomic counter) |
| `gcphone:clips:getComments` | Gets comments for a clip |
| `gcphone:clips:addComment` | Adds a comment |
| `gcphone:clips:deleteComment` | Deletes own comment |

## Config Options

```lua
Config.Features.Clips = true

Config.PublishJobs.clips = {}  -- empty = everyone can post

Config.Security.RateLimits.clips = 1500

Config.Storage  -- storage provider must be configured for video uploads
```

## Exports

None.
