# Manual Smoke Test

Use this checklist after UI, NUI callback, setup, NFC, or routing changes.

## First Boot

1. Start the resource in a clean player state.
2. Complete setup with language, PIN, mail alias, Snap, Chirp, Clips, and theme.
3. Verify the phone locks immediately after setup.
4. Enter the configured PIN and verify the home screen opens.
5. Open Mail and verify the initial account exists without asking for a password.

## Control Center And NFC

1. Open Control Center from the top-right pull area.
2. Toggle NFC off and verify nearby-player actions are disabled or hidden.
3. Toggle NFC on and verify nearby players refresh.
4. Drag brightness, volume, and flashlight sliders.
5. Verify slider drag does not switch to the notification area.
6. Trigger Wallet, Gallery, and Documents NFC actions with a nearby target.

## Core Apps

1. Open each visible home app once.
2. Verify empty states render with a title, description, and no overlapping text.
3. Verify Backspace or the app back button returns to the prior route.
4. Open multitasking and close one app.
5. Open multitasking again and use close all.

## Sensitive Actions

1. Delete a document, photo, note, or listing-like entry where available.
2. Verify a confirmation dialog appears before the action.
3. Cancel once and confirm the item remains.
4. Confirm once and verify the item is removed.

## Logs

1. Watch the client console for Lua errors.
2. Watch the server console for callback errors.
3. In browser/dev mode, verify there are no console errors or warnings after navigation.
