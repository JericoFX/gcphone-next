---
title: DarkRooms
---

# DarkRooms (Anonymous Forum)

![DarkRooms (Anonymous Forum)](/img/apps/darkrooms.png)

Reddit-style anonymous forum with rooms, posts, voting, and comments. Rooms can be password-protected. Posts support anonymous authorship and upvote/downvote scoring.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_darkrooms_rooms` | Rooms -- slug, name, description, icon, password_hash, created_by |
| `phone_darkrooms_members` | Room membership -- room_id, identifier, role (member/moderator) |
| `phone_darkrooms_posts` | Posts -- room_id, author_identifier, author_name, title, content, media_url, is_anonymous, score, comments_count |
| `phone_darkrooms_votes` | Vote records -- post_id, identifier, value (+1/-1) |
| `phone_darkrooms_comments` | Comments -- post_id, author_identifier, author_name, content, media_url, is_anonymous |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:darkrooms:getRooms` | Lists all rooms with member/post counts and membership status |
| `gcphone:darkrooms:createRoom` | Creates a new room (optionally password-protected) |
| `gcphone:darkrooms:joinRoom` | Joins a room (validates password if required) |
| `gcphone:darkrooms:getPosts` | Gets posts for a room (sort by new or top, pagination) |
| `gcphone:darkrooms:createPost` | Creates a post in a room (auto-joins if needed) |
| `gcphone:darkrooms:votePost` | Upvotes or downvotes a post (toggle on repeat) |
| `gcphone:darkrooms:getComments` | Gets comments for a post |
| `gcphone:darkrooms:createComment` | Creates a comment on a post |

## Config Options

```lua
Config.Features.DarkRooms = true
```

## Default Rooms

Created automatically on startup: General, Mercado, Vehiculos, Policia.

## Exports

None.
