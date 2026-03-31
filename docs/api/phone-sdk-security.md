---
title: Phone SDK Security
---

# Phone SDK — Security & Rate Limiting

Best practices and protection mechanisms for the Phone UI SDK.

---

## Rate Limits

The SDK enforces rate limits to prevent abuse from poorly written or malicious resources.

| Limit | Value | Scope |
|-------|-------|-------|
| Modal opens per resource per player | 3 per 10 seconds | Per resource × player |
| Modal opens per player (total) | 5 per 10 seconds | Per player across all resources |
| Notifications per resource per player | 5 per 30 seconds | Per resource × player |
| Max queued modals per player | 5 | Per player |
| Modal inactivity timeout | 60 seconds | Per active modal |
| Max registered UIs per resource | 20 | Per resource |
| Max queued modal wait | 120 seconds | Per queued modal |

### What happens when limits are hit

| Scenario | Return value | Server log |
|----------|-------------|------------|
| Rate limited | `nil, 'RATE_LIMITED'` | `[gcphone] [sdk] RATE_LIMITED: resource "X" for player N` |
| Queue full | `nil, 'QUEUE_FULL'` | -- |
| Timeout | `nil` | `[gcphone] [sdk] TIMEOUT: "X" for player N after 60s` |
| App blocked by player | `nil, 'APP_BLOCKED'` | -- |
| Phone closed | `nil, 'PHONE_CLOSED'` | -- |

---

## Modal Queue

Only one SDK modal is visible per player at a time. Additional modals enter a FIFO queue.

- **Queue depth:** max 5 modals. Beyond that, new modals are rejected with `QUEUE_FULL`.
- **Priority:** first-in, first-out. No priority system.
- **Auto-advance:** when the active modal closes (user action or timeout), the next queued modal appears.
- **Resource cleanup:** when a resource stops, all its queued modals are removed. If the active modal belongs to the stopped resource, it's closed and the next modal in queue appears.

---

## Input Validation

All data from external resources is sanitized before rendering:

| Data | Max Length | Sanitization |
|------|-----------|-------------|
| App title | 40 chars | Control chars stripped, HTML tags removed, trimmed |
| Element labels | 80 chars | Same |
| List item labels | 80 chars | Same |
| List item descriptions | 120 chars | Same |
| Button labels | 60 chars | Same |
| Text input values | 200 chars (configurable) | Same |
| Textarea values | 500 chars (configurable) | Same |
| Icon/emoji | 8 chars | Truncated |
| Image URLs | 500 chars | Must be `https://` or `http://` |
| Resource names | 40 chars | Same |

### Element limits

| Limit | Value |
|-------|-------|
| Elements per view | 20 |
| Views per registered UI | 10 |
| Action buttons per view | 4 |
| List items per list | 50 |
| Select options per select | 30 |
| Registered UIs per resource | 20 |

---

## URL Safety

Image URLs in `image` elements are validated:

- Must start with `https://` or `http://`
- Blocked protocols: `javascript:`, `data:`, `blob:`, `file:`, `vbscript:`
- Displayed in `<img>` tags with `referrerpolicy="no-referrer"`
- No iframes in the SDK (removed from the old MiniAppModal)

---

## Server-Side Logging

All SDK operations are logged to the server console for audit:

```
[gcphone] [sdk] Registered UI "mech_shop" from resource "qb-mechanic"
[gcphone] [sdk] "mech_shop" (resource: qb-mechanic) opened UI for player 1
[gcphone] [sdk] "mech_shop" result: view=upgrades option=buy (3.2s)
[gcphone] [sdk] RATE_LIMITED: resource "bad_script" exceeded limit for player 5
[gcphone] [sdk] TIMEOUT: "mech_shop" for player 1 after 60s
[gcphone] [sdk] Unregistered "mech_shop" (resource "qb-mechanic" stopped)
```

---

## Resource Cleanup

When a resource stops (`onResourceStop`):

1. All its registered UIs are removed from the registry
2. All associated `onPhoneUIOpened` and `onPhoneUIResult` handlers are removed
3. All visibility overrides for those UIs are cleared
4. A `gcphone:sdk:resourceStopped` event notifies all clients
5. Any queued modals from that resource are removed from player queues
6. If the active modal belongs to the stopped resource, it's closed

No manual cleanup is required — the system handles it automatically. However, calling `unregisterPhoneUI(id)` explicitly is still good practice.

---

## Best Practices for Developers

### Do

- **Validate server-side.** The SDK returns form data — validate it in your server handler before acting. Never trust client input.
- **Use specific permissions.** Only request the permissions you actually need. Players are more likely to reject apps that ask for too many permissions.
- **Handle `nil` returns.** Every SDK export can return `nil`. Always check the return value before proceeding.
- **Clean up on resource stop.** UIs are auto-cleaned, but explicitly unregistering is cleaner.
- **Use `description` on list items.** It helps players understand what they're selecting.

### Don't

- **Don't spam modals.** Rate limits exist to protect the player experience. If you need frequent UI updates, consider using notifications instead.
- **Don't store sensitive data in view definitions.** View definitions are sent to the client as-is. Don't include server secrets, passwords, or admin-only data.
- **Don't use `setPhoneUIVisibleAll(true)` without reason.** Only make apps globally visible if they're genuinely useful to all players.
- **Don't rely on the 60s timeout.** Design your UIs to be quick and clear. If a player needs 60 seconds, the UI is probably too complex.
- **Don't bypass permissions.** If `phoneGetContacts` returns `PERMISSION_DENIED`, respect it. Don't try to find workarounds.
