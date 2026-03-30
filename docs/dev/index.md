# gcphone-next Developer Guide

gcphone-next is a FiveM in-game smartphone resource built with SolidJS (NUI frontend), Lua (client + server scripts), and oxmysql for persistence. The phone renders inside a NUI iframe and communicates with the game through a signed NUI callback bridge.

## Architecture

```
SolidJS NUI (browser)
  │  fetchNui(eventName, data)
  │  POST https://<resource>/<eventName>
  ▼
FiveM Client Lua
  │  RegisterNUICallback(eventName, cb)
  │  lib.callback('gcphone:<name>', false, cb, data)
  ▼
FiveM Server Lua
  │  lib.callback.register('gcphone:<name>', fn)
  │  MySQL.query.await / MySQL.insert.await
  ▼
oxmysql → MariaDB/MySQL
```

## How Apps Work

- Each app is a SolidJS component registered in `config/apps.ts`.
- Apps are **lazy-loaded** via `solid-js` `lazy()` in `PhoneFrame.tsx`.
- A **stack-based router** (`useRouter()`) manages navigation with forward/back animations.
- Apps that have been opened stay mounted (multitasking) until explicitly closed.
- Per-app state uses `createAppStore()`. Shared state lives in global store providers (`usePhone`, `useContacts`, `useMessages`, etc.).
- Data fetching uses `createAppLoader()` which wraps `fetchNui` with loading/error/refetch/mutate.

## Quick Links

- [Quick Start](./quick-start.md) -- Create a new app from scratch
- [App Lifecycle](./app-lifecycle.md) -- Navigation, routing, multitasking
- [Data Fetching](./data-fetching.md) -- createAppLoader, fetchNui, polling
- [State Management](./state-management.md) -- Local and global stores
- [NUI Bridge](./nui-bridge.md) -- NUI communication, auth, Lua callbacks
- [UI Components](./ui-components.md) -- AppView, Modal, ActionSheet, ScreenState, Avatar, etc.
- [Styling](./styling.md) -- SCSS Modules, CSS variables, iOS utility classes, themes
- [Hooks Reference](./hooks-reference.md) -- All hooks: createAppLoader, useNfcShare, usePollingTask, etc.
- [Patterns](./patterns.md) -- SolidJS do's and don'ts, common mistakes
- [Server Integration](./server-integration.md) -- End-to-end Lua module + NUI + frontend guide

## Directory Structure

```
web/src/
  components/apps/<app-name>/    -- App component + sub-components
  config/apps.ts                 -- App registry (AppDefinition[])
  hooks/                         -- createAppLoader, createAppStore, etc.
  store/                         -- Global stores (phone, contacts, messages, ...)
  utils/fetchNui.ts              -- NUI fetch with auth
  utils/useNui.ts                -- NUI event listeners

client/
  nui_bridge.lua                 -- RegisterNUICallback handlers
  main.lua                       -- Client entry, phone state

server/modules/
  contacts.lua, messages.lua...  -- lib.callback.register handlers + MySQL
```
