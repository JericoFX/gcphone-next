---
title: Chirp
---

# Chirp (Twitter/X Clone)

![Chirp (Twitter/X Clone)](/img/apps/chirp.png)

Social media app with tweets, likes, rechirps, comments, following/followers, private accounts, and follow request management.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_chirp_accounts` | User profiles -- username, display_name, avatar, bio, verified, is_private, followers/following counts |
| `phone_chirp_tweets` | Tweets -- content, media_url, likes/rechirps/replies counts |
| `phone_chirp_likes` | Like relationships (tweet_id, account_id) |
| `phone_chirp_following` | Follow relationships (follower_id, following_id) |
| `phone_chirp_comments` | Comments on tweets (tweet_id, account_id, content) |
| `phone_chirp_rechirps` | Rechirps with optional comment/media (original_tweet_id, account_id, content, media_url) |
| `phone_friend_requests` | Follow requests for private accounts (type = 'chirp') |
| `phone_social_notifications` | Social notifications for rechirps and follow events |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:chirp:getAccount` | Returns the caller's Chirp account |
| `gcphone:chirp:createAccount` | Creates a new Chirp account with a unique username |
| `gcphone:chirp:updateAccount` | Toggles the account's private mode |
| `gcphone:chirp:getTweets` | Fetches tweets with tab filter (forYou, following, myActivity), pagination |
| `gcphone:chirp:publishTweet` | Publishes a new tweet |
| `gcphone:chirp:toggleLike` | Likes or unlikes a tweet |
| `gcphone:chirp:toggleRechirp` | Rechirps or un-rechirps a tweet (optional comment) |
| `gcphone:chirp:getComments` | Gets comments for a tweet |
| `gcphone:chirp:addComment` | Adds a comment to a tweet |
| `gcphone:chirp:deleteComment` | Deletes own comment |
| `gcphone:chirp:deleteTweet` | Deletes own tweet |
| `gcphone:chirp:follow` | Follow/unfollow a user (handles private account requests) |
| `gcphone:chirp:getPendingFollowRequests` | Gets incoming follow requests |
| `gcphone:chirp:getSentFollowRequests` | Gets outgoing follow requests |
| `gcphone:chirp:respondFollowRequest` | Accept or reject a follow request |
| `gcphone:chirp:cancelFollowRequest` | Cancel a sent follow request |
| `gcphone:chirp:getProfile` | Gets a user's profile, tweets, and relationship status |

## Config Options

```lua
Config.Chirp = {
    MaxTweetLength  = 280,
    MaxTweetsPerDay = 100,
    AllowMedia      = true,
}

Config.PublishJobs.chirp = {}  -- empty = everyone can post

Config.Security.RateLimits.chirp = 1400
```

## Exports

None.
