---
title: MatchMyLove
---

# MatchMyLove

![MatchMyLove](/img/apps/matchmylove.png)

Tinder-style dating app with swipeable profile cards, mutual matching, and in-app messaging between matches.

## Database Tables

| Table | Purpose |
|---|---|
| `phone_matchmylove_profiles` | Player profiles -- identifier, display_name, age, bio, gender, looking_for, photos (JSON), interests (JSON), is_active |
| `phone_matchmylove_swipes` | Swipe history -- swiper_identifier, target_identifier, direction (like/dislike) |
| `phone_matchmylove_matches` | Mutual matches -- identifier_a, identifier_b, matched_at |
| `phone_matchmylove_messages` | Match messages -- match_id, sender_identifier, message, created_at |

## Server Callbacks

| Callback | Purpose |
|---|---|
| `gcphone:matchmylove:getProfile` | Returns the caller's profile |
| `gcphone:matchmylove:createProfile` | Creates a new dating profile |
| `gcphone:matchmylove:updateProfile` | Updates bio, photos, interests, preferences |
| `gcphone:matchmylove:deleteProfile` | Deletes profile and all associated data |
| `gcphone:matchmylove:getCards` | Fetches unswiped profiles to display |
| `gcphone:matchmylove:swipe` | Records a like or dislike; creates match if mutual |
| `gcphone:matchmylove:getMatches` | Lists all current matches |
| `gcphone:matchmylove:getMessages` | Gets messages for a match |
| `gcphone:matchmylove:sendMessage` | Sends a message to a match |
| `gcphone:matchmylove:unmatch` | Unmatches and deletes conversation |

## Config Options

```lua
Config.Features.MatchMyLove = true

Config.MatchMyLove = {
    MaxPhotos = 6,
    MaxInterests = 10,
    MaxBioLength = 500,
    MaxMessageLength = 500,
    CardsPerFetch = 10,
}
```

## Notes

- Profile is auto-created during phone setup (display_name from character name, default age 25)
- Gender options: `male`, `female`, `other`
- Looking for options: `male`, `female`, `everyone`
- Cards exclude already-swiped profiles and inactive profiles
