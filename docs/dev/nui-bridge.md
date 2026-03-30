# NUI Bridge

## Communication Flow

```
┌─────────────────────────────────────────────────────────────┐
│ SolidJS (browser)                                           │
│                                                             │
│  fetchNui('getContacts', { ... })                           │
│    → POST https://gcphone-next/getContacts                  │
│      body: { _gc: { token, seq, sig }, data: { ... } }     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Client Lua (nui_bridge.lua)                                 │
│                                                             │
│  RegisterNUICallback('getContacts', function(data, cb)      │
│    lib.callback('gcphone:getContacts', false, function(res) │
│      cb(res or {})                                          │
│    end, data)                                               │
│  end)                                                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Server Lua (server/modules/*.lua)                           │
│                                                             │
│  lib.callback.register('gcphone:getContacts', function(src) │
│    return MySQL.query.await('SELECT ...', { identifier })   │
│  end)                                                       │
└─────────────────────────────────────────────────────────────┘
```

## fetchNui Signature

```ts
// web/src/utils/fetchNui.ts

async function fetchNui<T = unknown>(
  eventName: string,
  data?: unknown,
  mockData?: T
): Promise<T>;
```

- `eventName` -- must match the first argument to `RegisterNUICallback` in Lua.
- `data` -- arbitrary payload, sent as `{ data: ... }` in the POST body.
- `mockData` -- returned in browser dev mode when no mock handler exists. Also used as fallback when the NUI request fails.

## useNuiCallback (Receiving Events)

Subscribe to NUI events pushed from the Lua side. Auto-cleans up on component unmount.

```ts
// web/src/hooks/useNuiCallback.ts

function useNuiCallback<T = unknown>(
  eventName: string,
  handler: (data: T) => void
): void;
```

Example:

```tsx
import { useNuiCallback } from '@/hooks/useNuiCallback';

useNuiCallback<TemplateItem>('templateItemUpdated', (item) => {
  items.mutate((prev) => prev.map((i) => (i.id === item.id ? item : i)));
});
```

Under the hood, this calls `useNuiCustomEvent` which listens for internal events dispatched via `emitInternalEvent`.

### Lower-Level: useNuiEvent

For raw NUI `window.postMessage` events (action/data format):

```ts
import { useNuiEvent } from '@/utils/useNui';

useNuiEvent<Contact[]>('contactsUpdated', (contacts) => {
  // handle raw NUI message with action='contactsUpdated'
});
```

## NUI Auth System

Every `fetchNui` call includes authentication headers to prevent unauthorized NUI callbacks:

```ts
// Included in every POST body as _gc:
{
  _gc: {
    token: string,  // Rotated auth token set by the server
    seq: number,     // Monotonically increasing sequence number
    sig: string      // FNV-1a hash of `${token}|${seq}|${eventName}`
  },
  data: { ... }
}
```

### Token Rotation

The server sends a new token to the client via `setNuiAuthToken(token)`. The token is stored in module scope and included in every subsequent request.

### FNV-1a Signature

```ts
function buildNuiSig(token: string, seq: number, eventName: string): string {
  const input = `${token}|${seq}|${eventName}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
```

The server validates the token, sequence, and signature to reject forged or replayed NUI requests.

## Adding a New NUI Callback (Lua Side)

### Step 1: Client -- nui_bridge.lua

```lua
-- client/nui_bridge.lua

RegisterNUICallback('myappGetItems', function(data, cb)
    lib.callback('gcphone:myappGetItems', false, function(items)
        cb(items or {})
    end, data)
end)
```

- First arg: event name (must match `fetchNui` call).
- `data`: the payload from the NUI request (already parsed from JSON).
- `cb(result)`: sends the response back to the NUI.
- `lib.callback(name, false, cb, ...)`: calls the server callback. The `false` means async (non-blocking).

### Step 2: Server -- server/modules/myapp.lua

```lua
-- server/modules/myapp.lua

local Bridge = require 'server.bridge'
local Phone = require 'server.modules.phone'

lib.callback.register('gcphone:myappGetItems', function(source, data)
    local identifier = Bridge.GetIdentifier(source)
    if not identifier then return {} end

    return MySQL.query.await(
        'SELECT id, title FROM phone_myapp WHERE identifier = ?',
        { identifier }
    ) or {}
end)
```

### Step 3: Frontend -- fetchNui call

```ts
const items = await fetchNui<MyItem[]>('myappGetItems', { filter: 'active' }, []);
```

## Sending Events from Server to Client (Push)

To push data from server to a specific client:

```lua
-- Server side
TriggerClientEvent('gcphone:myappUpdated', source, updatedData)
```

The client receives this via standard FiveM event handling, which then posts to the NUI via `SendNUIMessage`.

## Security Considerations

1. **Always validate on the server.** Never trust data from the NUI -- treat all input as untrusted.
2. **Use `Bridge.GetIdentifier(source)`** to get the player's identifier. Never accept identifiers from the client payload.
3. **Check read-only mode** with `Phone.IsPhoneReadOnly(source)` before mutations.
4. **Sanitize inputs** with `Utils.SafeText(value, maxLen)` and `Utils.SafePhone(value)` before database queries.
5. **Use parameterized queries** (`MySQL.query.await('SELECT ... WHERE id = ?', { id })`) -- never concatenate user input into SQL.
6. **The NUI auth system** (token + seq + sig) prevents external tools from calling NUI callbacks. The server rotates the token periodically.
