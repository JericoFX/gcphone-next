---
title: Contacts
---

# Contacts

![Contacts](/img/apps/contacts.png)

Manage the player's contact list. Supports add, edit, delete, favorite toggle, proximity sharing, and accepting shared contacts.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_contacts` | Contact entries -- identifier, number, display, avatar, favorite |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:getContacts` | Returns all contacts for the player, sorted by favorite then display name |
| `gcphone:addContact` | Adds a new contact (prevents duplicates by number) |
| `gcphone:updateContact` | Updates an existing contact's name, number, and avatar |
| `gcphone:deleteContact` | Deletes a contact by ID |
| `gcphone:toggleFavorite` | Toggles the favorite flag on a contact |
| `gcphone:shareContact` | Sends a contact to a nearby player via proximity |
| `gcphone:acceptSharedContact` | Accepts and saves a contact shared by another player |

## Config Options

```lua
Config.Contacts = {
    MaxContacts       = 200,
    AllowSharing      = true,
    ProximityDistance  = 3.0,
}
```

## Exports

| Export | Signature | Purpose |
|---|---|---|
| `GetContacts` | `(identifier, requestSource) -> table[]` | Returns contact list (access-checked) |

## Hooks

Fires `TriggerPhoneHook` for:
- `contactAdded` -- when a contact is created
- `contactUpdated` -- when a contact is edited
- `contactDeleted` -- when a contact is removed
