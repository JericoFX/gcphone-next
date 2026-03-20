---
title: News
---

# News

![News](/img/apps/news.png)

News publishing platform with articles, categories, live broadcasts with real-time chat, reactions, viewer tracking, scaleform overlays, and moderation (mute/remove messages).

## Database Tables

| Table | Purpose |
|---|---|
| `phone_news` | Articles -- identifier, author_name, author_avatar, author_verified, title, content, media_url, media_type, category, is_live, live_viewers, views |
| `phone_snap_accounts` | Read -- resolves author profile (display_name, avatar) |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:news:getArticles` | Fetches articles with optional category filter and pagination |
| `gcphone:news:getLiveNews` | Returns currently active live broadcasts |
| `gcphone:news:publishArticle` | Publishes an article (job-restricted) |
| `gcphone:news:startLive` | Starts a live broadcast with optional scaleform |
| `gcphone:news:joinLive` | Joins a live broadcast as a viewer |
| `gcphone:news:leaveLive` | Leaves a live broadcast |
| `gcphone:news:sendLiveMessage` | Sends a chat message in a live broadcast |
| `gcphone:news:sendLiveReaction` | Sends an emoji reaction in a live broadcast |
| `gcphone:news:removeLiveMessage` | Host removes a chat message (moderation) |
| `gcphone:news:muteLiveUser` | Host mutes a user in a live broadcast |
| `gcphone:news:setScaleform` | Updates the live scaleform overlay |
| `gcphone:news:getScaleform` | Gets the current scaleform for a live broadcast |
| `gcphone:news:endLive` | Ends a live broadcast |
| `gcphone:news:deleteArticle` | Deletes own article |
| `gcphone:news:viewArticle` | Increments view count on an article |
| `gcphone:news:getCategories` | Returns the configured news categories |
| `gcphone:news:getAccount` | Returns the Snap account (shared profile system) |
| `gcphone:news:createAccount` | Creates a Snap account for news |
| `gcphone:news:updateAccount` | Updates the news profile (display name, avatar, bio) |

## Config Options

```lua
Config.News = {
    MaxArticlesPerDay = 20,
    AllowLive         = true,
    MaxLiveDuration   = 3600,
    Categories = {
        { id = 'general', label = 'General', icon = '...' },
        { id = 'urgent',  label = 'Urgente', icon = '...' },
        ...
    },
}

Config.PublishJobs.news = { 'news', 'reporter', 'journalist' }

Config.Security.RateLimits.news = 2500
```

## Exports

None.
