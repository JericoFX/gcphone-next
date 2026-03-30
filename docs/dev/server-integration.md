# Server Integration

End-to-end guide for adding server-side functionality. The data flow is:

```
SolidJS (fetchNui) → Client Lua (RegisterNUICallback) → Server Lua (lib.callback) → MySQL
```

## 1. Create Server Module

Server modules live in `server/modules/`. Each module requires its dependencies and registers `lib.callback` handlers.

```lua
-- server/modules/bookmarks.lua

local Bridge = require 'server.bridge'
local Phone  = require 'server.modules.phone'
local Utils  = require 'server.lib.utils'

local function GetBookmarks(identifier)
    if not identifier then return {} end
    return MySQL.query.await(
        'SELECT id, url, title, created_at FROM phone_bookmarks WHERE identifier = ? ORDER BY created_at DESC',
        { identifier }
    ) or {}
end

lib.callback.register('gcphone:getBookmarks', function(source)
    local identifier = Phone.GetPhoneOwnerIdentifier(source, true)
    return GetBookmarks(identifier)
end)

lib.callback.register('gcphone:addBookmark', function(source, data)
    -- Check read-only mode
    if Phone.IsPhoneReadOnly(source) then return false, 'READ_ONLY' end

    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end

    -- Validate and sanitize inputs
    local url   = type(data) == 'table' and Utils.SafeText(data.url, 500) or nil
    local title = type(data) == 'table' and Utils.SafeText(data.title, 100) or nil

    if not url or not title then
        return false, 'Invalid data'
    end

    local id = MySQL.insert.await(
        'INSERT INTO phone_bookmarks (identifier, url, title) VALUES (?, ?, ?)',
        { identifier, url, title }
    )

    -- Push updated list to client
    TriggerClientEvent('gcphone:bookmarksUpdated', source, GetBookmarks(identifier))

    return true, id
end)

lib.callback.register('gcphone:deleteBookmark', function(source, bookmarkId)
    if Phone.IsPhoneReadOnly(source) then return false end
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return false end

    local id = tonumber(bookmarkId)
    if not id then return false end

    MySQL.update.await(
        'DELETE FROM phone_bookmarks WHERE id = ? AND identifier = ?',
        { id, identifier }
    )

    TriggerClientEvent('gcphone:bookmarksUpdated', source, GetBookmarks(identifier))
    return true
end)

return {}
```

### Key Patterns

- **`Phone.GetPhoneOwnerIdentifier(source, true)`** -- gets the identifier of whoever owns the phone the player is using (handles foreign phone access).
- **`Bridge.GetIdentifier(source)`** -- gets the player's own identifier.
- **`Phone.IsPhoneReadOnly(source)`** -- returns true when the player is viewing someone else's phone.
- **Return values**: return `true/false` as first value, optional error code or data as second.

### Input Validation Utilities

| Function | Usage |
|---|---|
| `Utils.SafeText(input, maxLen)` | Strips dangerous chars, enforces max length. Returns `nil` if invalid. |
| `Utils.SafePhone(input)` | Validates and normalizes phone numbers. Returns `nil` if invalid. |
| `Utils.SanitizeMediaUrl(input)` | Validates media URLs (http/https only). Returns `nil` if invalid. |
| `Utils.HitRateLimit(source, key, windowMs, maxHits)` | Returns `true` if rate limit exceeded. |

---

## 2. Add NUI Callback

NUI callbacks live in `client/nui_bridge.lua`. They bridge the NUI frontend to server callbacks.

```lua
-- client/nui_bridge.lua (add at appropriate section)

RegisterNUICallback('getBookmarks', function(_, cb)
    lib.callback('gcphone:getBookmarks', false, function(bookmarks)
        cb(bookmarks or {})
    end)
end)

RegisterNUICallback('addBookmark', function(data, cb)
    lib.callback('gcphone:addBookmark', false, function(success, value)
        if success then
            cb(cbSuccess(true, nil, { id = value }))
            return
        end
        cb(cbSuccess(false, value))
    end, data)
end)

RegisterNUICallback('deleteBookmark', function(data, cb)
    lib.callback('gcphone:deleteBookmark', false, function(success)
        cb(cbSuccess(success))
    end, tonumber(data.id))
end)
```

### Pattern

1. `RegisterNUICallback(eventName, function(data, cb)` -- the `eventName` matches what the frontend calls via `fetchNui`.
2. `lib.callback('gcphone:<name>', false, function(result) ... end, data)` -- calls the server. Second arg `false` means non-blocking.
3. Use `cbSuccess(success, message?, extra?)` helper to format the response.

---

## 3. Frontend Integration

### fetchNui Call

```tsx
import { fetchNui } from '@/utils/fetchNui';

// Type the response
interface Bookmark {
  id: number;
  url: string;
  title: string;
  created_at: string;
}

// Fetch with mock data for browser development
const bookmarks = await fetchNui<Bookmark[]>('getBookmarks', {}, []);

// Write operation
const result = await fetchNui<{ success: boolean; id?: number; message?: string }>(
  'addBookmark',
  { url: 'https://example.com', title: 'Example' },
  { success: true, id: 999 }  // Mock for browser
);

if (result.success) {
  loader.refetch();
}
```

### With createAppLoader

```tsx
const loader = createAppLoader(
  () => fetchNui<Bookmark[]>('getBookmarks', {}, []),
  { initialData: [] }
);
```

### Type Definitions

Define types in your app's directory or a shared types file:

```ts
// web/src/components/apps/bookmarks/types.ts
export interface Bookmark {
  id: number;
  url: string;
  title: string;
  created_at: string;
}
```

---

## 4. Server-to-Client Push Events

For real-time updates pushed from server to client (e.g. receiving a message from another player).

### Server Side

```lua
-- Push data to a specific player
TriggerClientEvent('gcphone:bookmarksUpdated', targetSource, bookmarksList)
```

### Client Side (Lua)

Register a handler in `client/nui_bridge.lua` or the relevant client module:

```lua
RegisterNetEvent('gcphone:bookmarksUpdated', function(bookmarks)
    SendNUIMessage({
        type = 'bookmarksUpdated',
        data = bookmarks
    })
end)
```

### Frontend (SolidJS)

Listen for the NUI message with `useNuiCallback`:

```tsx
import { useNuiCallback } from '@/hooks';

useNuiCallback<Bookmark[]>('bookmarksUpdated', (bookmarks) => {
    loader.mutate(() => bookmarks);
});
```

### Full Push Flow

```
Server: TriggerClientEvent('gcphone:bookmarksUpdated', source, data)
  → Client Lua: RegisterNetEvent → SendNUIMessage({ type, data })
    → Frontend: useNuiCallback('bookmarksUpdated', handler)
```

---

## 5. Security Checklist

Follow these rules for every server module:

### Input Validation

- [ ] All inputs from `data` are validated before use
- [ ] Use `Utils.SafeText()` for strings
- [ ] Use `Utils.SafePhone()` for phone numbers
- [ ] Use `Utils.SanitizeMediaUrl()` for URLs
- [ ] Use `tonumber()` for numeric IDs
- [ ] Check `type(data) == 'table'` before accessing fields
- [ ] Return early with error if validation fails

### Authorization

- [ ] Check `Phone.IsPhoneReadOnly(source)` for write operations
- [ ] Verify `Bridge.GetIdentifier(source)` is not nil
- [ ] Include `identifier` in WHERE clauses (row-level ownership)
- [ ] Never trust client-provided identifiers

### Rate Limiting

- [ ] Use `Utils.HitRateLimit(source, key, windowMs, maxHits)` on expensive or abusable operations
- [ ] Return `'RATE_LIMITED'` error code so the frontend can show appropriate feedback

### SQL Safety

- [ ] Always use parameterized queries (`?` placeholders)
- [ ] Never concatenate user input into SQL strings
- [ ] Use `MySQL.query.await`, `MySQL.insert.await`, `MySQL.update.await`, `MySQL.scalar.await`, `MySQL.single.await`

### General

- [ ] Never log sensitive data (identifiers, tokens)
- [ ] Return minimal data (don't expose internal IDs or identifiers to other players)
- [ ] Handle nil/missing data gracefully (return empty tables, not errors)
- [ ] Test with read-only phone mode (foreign phone access)

---

## Example: Complete Feature

Here is the full stack for a "bookmark" feature:

**SQL migration:**

```sql
CREATE TABLE IF NOT EXISTS phone_bookmarks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  identifier VARCHAR(60) NOT NULL,
  url VARCHAR(500) NOT NULL,
  title VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_identifier (identifier)
);
```

**Server:** `server/modules/bookmarks.lua` (see section 1 above)

**Client:** Add callbacks in `client/nui_bridge.lua` (see section 2)

**Frontend:**

```tsx
// web/src/components/apps/bookmarks/BookmarksApp.tsx
import { createSignal } from 'solid-js';
import { For } from 'solid-js';
import { AppView } from '@/components/shared/layout/AppView';
import { AppFAB } from '@/components/shared/layout/AppLayout';
import { Modal, FormField, ModalActions, ModalButton } from '@/components/shared/ui/Modal';
import { createAppLoader } from '@/hooks';
import { fetchNui } from '@/utils/fetchNui';
import { useNuiCallback } from '@/hooks';

interface Bookmark {
  id: number;
  url: string;
  title: string;
}

export function BookmarksApp() {
  const loader = createAppLoader(
    () => fetchNui<Bookmark[]>('getBookmarks', {}, []),
    { initialData: [] }
  );

  const [showAdd, setShowAdd] = createSignal(false);
  const [newUrl, setNewUrl] = createSignal('');
  const [newTitle, setNewTitle] = createSignal('');

  useNuiCallback<Bookmark[]>('bookmarksUpdated', (data) => {
    loader.mutate(() => data);
  });

  const handleAdd = async () => {
    const result = await fetchNui<{ success: boolean }>(
      'addBookmark',
      { url: newUrl(), title: newTitle() },
      { success: true }
    );
    if (result.success) {
      setShowAdd(false);
      setNewUrl('');
      setNewTitle('');
    }
  };

  const handleDelete = async (id: number) => {
    await fetchNui('deleteBookmark', { id }, { success: true });
  };

  return (
    <AppView title="Bookmarks" loader={loader} emptyTitle="No bookmarks">
      {(bookmarks) => (
        <>
          <div class="ios-list">
            <For each={bookmarks}>
              {(bm) => (
                <div class="ios-row">
                  <div>
                    <div class="ios-label">{bm.title}</div>
                    <div class="ios-value">{bm.url}</div>
                  </div>
                </div>
              )}
            </For>
          </div>

          <AppFAB icon="+" onClick={() => setShowAdd(true)} />

          <Modal open={showAdd()} title="Add Bookmark" onClose={() => setShowAdd(false)}>
            <FormField label="Title" value={newTitle()} onChange={setNewTitle} />
            <FormField label="URL" value={newUrl()} onChange={setNewUrl} type="url" />
            <ModalActions>
              <ModalButton label="Cancel" onClick={() => setShowAdd(false)} />
              <ModalButton label="Save" onClick={handleAdd} tone="primary" />
            </ModalActions>
          </Modal>
        </>
      )}
    </AppView>
  );
}
```
