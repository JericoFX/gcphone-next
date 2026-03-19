---
title: Notifications
---

# Notifications

Persistent notification inbox that stores notifications in the database. Used by all other apps (mail, wallet, wavechat, etc.) to push notifications that survive reconnects.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_notifications` | Notification records -- identifier, app_id, title, content, avatar, meta (JSON), is_read, created_at |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:notifications:get` | Returns notifications with pagination and unread count |
| `gcphone:notifications:markRead` | Marks a single notification as read |
| `gcphone:notifications:markAllRead` | Marks all unread notifications as read |
| `gcphone:notifications:delete` | Deletes a single notification |

## Notification Payload Schema

```lua
---@class GCPhoneNotificationPayload
---@field appId string       -- App that owns the notification (e.g. 'messages', 'mail', 'bank')
---@field title string       -- Notification title
---@field content string     -- Notification body
---@field avatar? string     -- Optional avatar/image URL
---@field icon? string       -- Short glyph or icon text
---@field durationMs? int    -- Auto-dismiss duration (ignored when sticky)
---@field sticky? boolean    -- Keep visible until dismissed
---@field priority? string   -- 'low' | 'normal' | 'high'
---@field route? string      -- Route opened when tapped
---@field data? table        -- Route payload (e.g. { phoneNumber = '555-1111' })
---@field meta? table|string -- Persistent DB metadata
```

## Config Options

None specific to notifications.

## Exports

| Export | Signature | Purpose |
|---|---|---|
| `AddPersistentNotification` | `(identifier, payload) -> int\|nil` | Inserts a notification and pushes live if the player is online. Returns the notification ID. |
