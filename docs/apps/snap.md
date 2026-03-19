---
title: Snap
---

# Snap (Instagram-like)

Photo/video social media with posts, stories, likes, following/followers, private accounts, follow requests, live streaming with chat/reactions/moderation, proximity audio for lives, and discover feed.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_snap_accounts` | User profiles -- identifier, username, display_name, avatar, bio, verified, is_private, followers/following/posts counts |
| `phone_snap_posts` | Posts -- account_id, media_url, media_type, caption, likes, is_live, live_viewers |
| `phone_snap_stories` | Ephemeral stories -- account_id, media_url, media_type, expires_at, views |
| `phone_snap_likes` | Post like relationships (post_id, account_id) |
| `phone_snap_following` | Follow relationships (follower_id, following_id) |
| `phone_friend_requests` | Follow requests for private accounts (type = 'snap') |
| `phone_social_notifications` | Social notifications for follow events |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:snap:getAccount` | Returns the caller's Snap account |
| `gcphone:snap:createAccount` | Creates a new Snap account |
| `gcphone:snap:updateAccount` | Toggles private mode |
| `gcphone:snap:getFeed` | Returns the global post feed with like status |
| `gcphone:snap:getStories` | Returns non-expired stories |
| `gcphone:snap:getDiscoverAccounts` | Discover other accounts with follow status |
| `gcphone:snap:getDiscoverFeed` | Discover feed with search support |
| `gcphone:snap:publishPost` | Publishes a post (job-restricted) |
| `gcphone:snap:publishStory` | Publishes a story (24h expiry) |
| `gcphone:snap:toggleLike` | Likes/unlikes a post (syncs count) |
| `gcphone:snap:deletePost` | Deletes own post |
| `gcphone:snap:deleteStory` | Deletes own story |
| `gcphone:snap:startLive` | Starts a live stream |
| `gcphone:snap:endLive` | Ends a live stream |
| `gcphone:snap:getLiveStreams` | Returns all active live streams |
| `gcphone:snap:joinLive` | Joins a live stream as viewer |
| `gcphone:snap:leaveLive` | Leaves a live stream |
| `gcphone:snap:sendLiveMessage` | Sends chat message in a live stream |
| `gcphone:snap:sendLiveReaction` | Sends emoji reaction in a live stream |
| `gcphone:snap:removeLiveMessage` | Host removes a chat message |
| `gcphone:snap:muteLiveUser` | Host mutes a viewer |
| `gcphone:snap:getLiveAudioSession` | Returns proximity audio config for a live stream |
| `gcphone:snap:follow` | Follow/unfollow (handles private accounts) |
| `gcphone:snap:getPendingFollowRequests` | Gets incoming follow requests |
| `gcphone:snap:getSentFollowRequests` | Gets outgoing follow requests |
| `gcphone:snap:respondFollowRequest` | Accept/reject a follow request |
| `gcphone:snap:cancelFollowRequest` | Cancel a sent follow request |
| `gcphone:snap:getProfile` | Gets a user profile with posts and relationship |

## Config Options

```lua
Config.Snap = {
    StoryDuration   = 86400,
    MaxPostsPerDay  = 50,
    AllowLive       = true,
    MaxLiveDuration = 3600,
    LiveAudio = {
        Enabled           = true,
        ListenDistance     = 25.0,
        LeaveBufferMeters = 2.0,
        MinVolume         = 0.08,
        MaxVolume         = 1.0,
        DistanceCurve     = 1.35,
        VolumeSmoothing   = 0.35,
        UseMumbleRangeClamp = true,
        UpdateIntervalMs  = 220,
    },
}

Config.PublishJobs.snap = {}
Config.Security.RateLimits.snap = 1500
```

## Exports

None.
