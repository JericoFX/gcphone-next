---
title: Home Screen Folders
---

# Home Screen Folders

gcphone-next supports iOS-style home-screen folders. Players create them by dragging one icon on top of another in edit mode; opening a folder reveals its apps in a modal. Layout is persisted per identifier in `phone_layouts` with optimistic concurrency.

## Limits

| Constraint | Value | Where |
|---|---|---|
| Folders per device | `4` | `web/src/types/home.ts` → `MAX_FOLDERS`, `server/modules/phone_layouts.lua` → `M.MAX_FOLDERS` |
| Apps per folder | `4` | `MAX_APPS_PER_FOLDER` (client + server) |
| Folder name length | up to 20 codepoints (60 bytes) | `FOLDER_NAME_RE` (client), `FOLDER_NAME_MAX_BYTES` (server) |
| Folder name regex | `^[\p{L}\p{N}][\p{L}\p{N} _.\-]{0,19}$` | client only — server enforces byte length + control-char filter as defense-in-depth |
| Allowed colors | `blue`, `purple`, `pink`, `red`, `orange`, `green`, `teal`, `gray` | `ALLOWED_FOLDER_COLORS` |
| Pinned apps (never merged) | `contacts`, `messages`, `mail` | `PINNED_APP_IDS` |
| Server payload ceiling | `16 KB` | `M.MAX_LAYOUT_BYTES` |
| Rate-limit per source | `1.5s` between `setAppLayout` calls | `RATE_LIMIT_MS` |
| Client debounce | `400ms` after a layout mutation | `SAVE_DEBOUNCE_MS` in `web/src/store/phone.tsx` |

All server-side values are ceilings — the server treats client input as untrusted and clamps/filters regardless of what the UI sent.

## Data Shape

`AppLayout` is what both the client and server exchange:

```ts
interface Folder {
  id: string;              // matches /^folder_[a-z0-9]{10}$/
  name: string;
  color: AllowedFolderColor;
  apps: string[];          // app IDs, max 4
}

interface AppLayout {
  home: string[];          // app IDs and folder refs ("folder:<id>")
  menu: string[];          // app drawer (never contains folders or pinned apps)
  folders?: Folder[];
}
```

Folders live inside `AppLayout.folders`. On the home grid they appear as synthetic IDs of the form `folder:folder_xxxxxxxxxx`; the normalizer guarantees every home ref has a matching folder and vice versa.

## NUI Contract

### `getAppLayout`

Request payload: none.

Response:

```ts
{
  layout: AppLayout;
  version: number;  // 0 when no row exists yet
}
```

### `setAppLayout`

Request payload:

```ts
{
  layout: AppLayout;
  version: number;  // last version the client saw
}
```

Response:

```ts
| { ok: true;  version: number; layout: AppLayout }
| { ok: false; reason: 'version_conflict'; version: number; layout: AppLayout }
| { ok: false; reason: 'rate_limited' | 'too_large' | 'read_only' | 'invalid_payload' | 'invalid_version' | 'no_identity' }
```

When `reason === 'version_conflict'`, the server returns the authoritative layout and version; the client reconciles and discards in-flight changes. This is the mechanism that keeps two open phones (main device + dropped phone, alt tab, etc.) from overwriting each other.

## Validation Pipeline

Client and server run the same normalization pipeline (`web/src/utils/folderOps.ts` and `server/modules/phone_layouts.lua → M.NormalizeLayout`):

1. Parse `folders[]` respecting `MAX_FOLDERS`; drop invalid ids, names, colors; dedupe apps; filter pinned and disabled apps; drop empty folders.
2. Parse `home[]` keeping only valid folder refs, allowed app IDs, and enabled apps — no duplicates.
3. Append any folder refs missing from `home[]`.
4. Parse `menu[]`, skipping anything already placed.
5. Fill in remaining allowed/enabled apps into their default target (`home` or `menu`).
6. Re-sort `home` so the pinned IDs appear first.

The server pipeline is the source of truth. The client mirror keeps the UI responsive and lets merges animate instantly, but any divergence between the two is resolved in favor of the server response.

## Rate-Limiting & Debounce

- **Client**: every mutation (`reorderApp`, `createFolder`, `addAppToFolder`, …) schedules a save 400 ms later. Additional mutations within that window reset the timer — only the latest state hits the server.
- **Server**: `setAppLayout` rejects a second call within `1.5s` of the previous accepted one (`reason: 'rate_limited'`). The client re-schedules a debounced save in that case.
- **Cleanup**: `playerDropped` clears the rate-limit entry for that source.

## Error Reasons

| Reason | Meaning | Client action |
|---|---|---|
| `version_conflict` | Client version does not match server version | Apply server layout + version |
| `rate_limited` | Called too soon after previous `setAppLayout` | Re-schedule debounce (400 ms) |
| `too_large` | Normalized JSON exceeds 16 KB | Silent drop (normalization should prevent this) |
| `read_only` | Foreign read-only phone access | Silent drop |
| `invalid_payload` / `invalid_version` / `no_identity` | Malformed request | Silent drop |

## Migrating from 3.1.1

Apply `sql/upgrades/opt-folders-v2.sql` once:

```sql
ALTER TABLE `phone_layouts`
    ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 1 AFTER `layout_json`;
```

Existing rows without `folders[]` keep working — the normalizer tolerates the missing field. The first successful `setAppLayout` after the upgrade bumps that row to `version = 2`.

## Extending

- **Change limits** — update both `web/src/types/home.ts` (`MAX_FOLDERS`, `MAX_APPS_PER_FOLDER`) and `server/modules/phone_layouts.lua` (`M.MAX_FOLDERS`, `M.MAX_APPS_PER_FOLDER`). Keeping the two in sync is required for normalization to agree on both ends.
- **Add a color** — extend `ALLOWED_FOLDER_COLORS` in `web/src/types/home.ts`, register the matching `.color-<name>` and `.swatch-<name>` rules in `FolderIcon.module.scss`, `FolderModal.module.scss` and `AppGrid.module.scss`, then add the color to `M.AllowedFolderColors` in Lua.
- **Pin an app** — add its ID to `PINNED_APP_IDS` (client) and `M.PinnedHomeIds` (server). Pinned apps can never enter a folder and are pushed to the front of the home grid.
