---
title: Upgrade Notes
---

# Upgrade Notes

## AppStore Removal

`gcphone-next` no longer ships an AppStore-style app. Existing installations should treat third-party phone UIs as SDK shortcuts registered by server resources, not as downloadable phone apps.

Operational checklist:

1. Remove stale references to AppStore assets from custom app layouts, docs, or deployment notes.
2. Use Directorio for discoverability of registered SDK shortcuts.
3. Use Settings > Apps and Permissions to grant, revoke, block, or unblock SDK shortcut permissions.
4. Keep external resources responsible for registering their own phone UI with `registerPhoneUI`.
5. Rebuild `web/dist` after merging this upgrade so removed assets are not left in production output.

## Control Center Fixes

- NFC proximity from Control Center is now an explicit on/off control instead of an always-active surface.
- When NFC is off, the Control Center does not poll nearby players and blocks Wallet, Gallery, and Documents proximity actions.
- When NFC is on, the Control Center refreshes nearby players and passes the selected `targetServerId` into the existing NFC flows.
- If multiple nearby players are found, tapping the target row cycles the selected NFC recipient and the dot indicators can select a recipient directly.
