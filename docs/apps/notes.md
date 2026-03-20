---
title: Notes
---

# Notes

![Notes](/img/apps/notes.png)

Simple note-taking app with color-coded notes.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_notes` | Notes -- identifier, title, content, color, created_at, updated_at |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:notes:getAll` | Returns all notes for the player, sorted by most recently updated |
| `gcphone:notes:save` | Creates or updates a note (upsert by ID) |
| `gcphone:notes:delete` | Deletes a note by ID |

## Config Options

None specific to notes.

## Exports

None.
