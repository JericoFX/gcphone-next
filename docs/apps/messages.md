---
title: Messages
---

# Messages

SMS messaging with 1-on-1 conversations, WaveChat group messaging, group invites, WaveChat statuses (stories), GPS sharing via `%pos%`, auto-reply, media attachments, and blocked contact enforcement.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_messages` | SMS messages -- transmitter, receiver, message, media_url, is_read, owner, time |
| `phone_chat_groups` | Group chat metadata -- owner_identifier, name, avatar |
| `phone_chat_group_members` | Group membership -- group_id, identifier, role (owner/member) |
| `phone_chat_group_invites` | Pending group invitations -- group_id, inviter/target identifier, status |
| `phone_chat_group_messages` | Group messages -- group_id, sender_identifier, sender_number, message, media_url |
| `phone_wavechat_statuses` | 24-hour statuses -- identifier, phone_number, media_url, media_type, caption, views, expires_at |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:getMessages` | Returns all messages for the player |
| `gcphone:getConversation` | Returns a conversation with a specific phone number |
| `gcphone:sendMessage` | Sends an SMS (supports `%pos%` GPS, media, auto-reply, blocked check) |
| `gcphone:deleteMessage` | Deletes a single message |
| `gcphone:deleteConversation` | Deletes all messages in a conversation |
| `gcphone:markAsRead` | Marks messages from a number as read |
| `gcphone:getUnreadCount` | Returns the unread message count |
| `gcphone:wavechatGetGroups` | Returns all groups the player belongs to |
| `gcphone:wavechatGetInvites` | Returns pending group invitations |
| `gcphone:wavechatCreateGroup` | Creates a group and sends invitations to members |
| `gcphone:wavechatGetGroupMessages` | Returns messages for a group (limit 30) |
| `gcphone:wavechatRespondInvite` | Accept or decline a group invitation |
| `gcphone:wavechatSendGroupMessage` | Sends a message in a group (rate-limited, auto-trims to 30 messages) |
| `gcphone:wavechatGetStatuses` | Returns visible WaveChat statuses (own + contacts) |
| `gcphone:wavechatCreateStatus` | Creates a 24-hour status with media |
| `gcphone:wavechatMarkStatusViewed` | Increments view count on a status (debounced per 5 minutes) |
| `gcphone:setAutoReply` | Enables/disables auto-reply with a custom message |
| `gcphone:getAutoReply` | Returns the current auto-reply state |

## Config Options

```lua
Config.Messages = {
    MaxMessages      = 500,
    MaxMessageLength = 500,
    AllowGPS         = true,
    AllowPhotos      = true,
}

Config.Security.RateLimits.messages = 900
Config.Security.RateLimits.wavechat = 700
```

## Exports

| Export | Signature | Purpose |
|---|---|---|
| `GetMessages` | `(identifier, requestSource) -> table[]` | Returns message threads (access-checked) |
| `GetConversation` | `(identifier, targetNumber, requestSource) -> table[]` | Returns a conversation (access-checked) |
