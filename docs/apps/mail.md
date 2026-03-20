---
title: Mail
---

# Mail

![Mail](/img/apps/mail.png)

In-game email system with account creation, inbox/sent folders, attachments, read tracking, and soft-delete. Each player creates an email alias on a configurable domain.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_mail_accounts` | Email accounts -- identifier, alias, domain, email, password_hash, is_primary |
| `phone_mail_messages` | Email messages -- sender_account_id, recipient_email, recipient_account_id, subject, body, attachments (JSON), is_read, is_deleted_sender, is_deleted_recipient |
| `phone_mail_boxes` | Mailbox counters -- account_id, unread_count, total_count (maintained by DB triggers) |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:mail:getState` | Returns account info, inbox, sent, unread count, and domain (or setup prompt if no account) |
| `gcphone:mail:createAccount` | Creates a new email account with alias and password |
| `gcphone:mail:send` | Sends an email with optional attachments |
| `gcphone:mail:markRead` | Marks a single message as read |
| `gcphone:mail:getMessages` | Fetches messages for a folder (inbox/sent) with pagination |
| `gcphone:mail:delete` | Soft-deletes a message (sender or recipient side) |

## Config Options

```lua
Config.Features.Mail = true

Config.Mail = {
    Enabled         = true,
    Domain          = 'jericofx.gg',
    MinAliasLength  = 3,
    MaxAliasLength  = 24,
    MaxSubjectLength = 120,
    MaxBodyLength   = 4000,
    Attachments = {
        MaxCount      = 5,
        MaxTotalSize  = 31457280,
        AllowedTypes  = { 'image', 'video', 'document', 'link' },
    },
}
```

## Exports

| Export | Signature | Purpose |
|---|---|---|
| `SendInGameMail` | `(fromIdentifier, payload) -> { success, id?, error? }` | Send an email programmatically from an external resource |
