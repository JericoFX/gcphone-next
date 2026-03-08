# GCPhone Mock Commands

Open the web phone in browser mode and run these from the devtools console.

Base object:

```js
window.gcphoneMock
```

Startup helpers:

```js
window.gcphoneMock.boot()
window.gcphoneMock.reset()
window.gcphoneMock.showHome()
window.gcphoneMock.showSetup()
```

- `boot()` sends `initPhone` and `showPhone` again.
- `reset()` hides the phone and reopens it.
- `showHome()` reopens the phone with `requiresSetup = false`.
- `showSetup()` reopens the phone with `requiresSetup = true`.

Quick event helpers:

```js
window.gcphoneMock.incomingMessage()
window.gcphoneMock.incomingCall()
window.gcphoneMock.contactRequest()
```

Realtime config helpers:

```js
window.gcphoneMock.getRealtime()
window.gcphoneMock.setRealtime({ socketHost: 'ws://127.0.0.1:3012' })
window.gcphoneMock.clearRealtime()
window.gcphoneMock.generateRealtime()
window.gcphoneMock.importRealtimeFromText(text)
window.gcphoneMock.exportRealtimeAsSetr()
await window.gcphoneMock.copyRealtimeAsSetr()
window.gcphoneMock.previewRealtime('call-test-room')
window.gcphoneMock.useLocalRealtime()
window.gcphoneMock.openRealtimePanel()
window.gcphoneMock.closeRealtimePanel()
```

What each realtime helper does:

- `getRealtime()` reads the current stored mock realtime config.
- `setRealtime(partial)` updates part of the realtime config.
- `clearRealtime()` removes stored realtime overrides.
- `generateRealtime(partial)` creates a full config from defaults plus overrides.
- `importRealtimeFromText(text)` parses installer/setr text and stores the extracted values.
- `exportRealtimeAsSetr()` returns the current config as setr lines.
- `copyRealtimeAsSetr()` copies the current setr block to the clipboard.
- `previewRealtime(roomName)` builds a preview object for a room.
- `useLocalRealtime(socketToken?, livekitToken?)` points the mock to local socket/livekit defaults.
- `openRealtimePanel()` opens the browser realtime debug panel.
- `closeRealtimePanel()` closes the browser realtime debug panel.

Notes:

- Browser mock startup state is controlled mainly through `showHome()` and `showSetup()`.
- The browser environment intentionally skips the real lock-screen behavior, so there is no true `showLocked()` helper yet.
