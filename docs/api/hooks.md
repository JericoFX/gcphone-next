---
title: Hook System
---

# Hook System

The hook system allows external resources to intercept and optionally cancel phone events before they are processed. Hooks run synchronously on the server side.

**Source file:** `server/modules/hooks.lua`

## Architecture

1. External resources register callbacks for specific hook events using the `registerHook` export.
2. When a phone action occurs (e.g. a call is started), the phone resource calls `triggerHook` with the event name and a payload.
3. All registered callbacks for that event are invoked in registration order.
4. If any callback returns `false`, the action is **cancelled** and `triggerHook` returns `false`.
5. If all callbacks succeed (return anything other than `false`), the action proceeds normally.
6. Hooks registered by a resource are automatically cleaned up when that resource stops.

## Allowed Hooks

Only the following event names can be hooked. Attempting to register or trigger an unknown event returns `false`.

| Hook Event | Trigger Context | Payload Fields |
|------------|----------------|----------------|
| `numberDialed` | A phone number was dialed (before the call is routed) | `source`, `phoneNumber`, `targetNumber` |
| `callStarted` | A call was successfully started | `source`, `callId`, `caller`, `receiver` |
| `emergencyCallStarted` | An emergency SOS call was initiated | `source`, `phoneNumber`, `coords` |
| `contactAdded` | A new contact was added | `source`, `identifier`, `contact` |
| `contactUpdated` | A contact was updated | `source`, `identifier`, `contact` |
| `contactDeleted` | A contact was deleted | `source`, `identifier`, `contactId` |
| `messageSent` | An SMS message was sent | `source`, `identifier`, `message` |
| `mailAccountCreated` | A mail account was created | `source`, `identifier`, `address` |
| `phoneSetupCompleted` | Phone initial setup was completed | `source`, `identifier` |
| `deviceUnlocked` | The phone was unlocked with a PIN | `source`, `identifier` |
| `imeiViewed` | The IMEI was viewed in settings | `source`, `identifier`, `imei` |

## Exports

### `registerHook`

Register a callback for a hook event.

```lua
---@param event string       -- One of the AllowedHooks names
---@param cb function        -- Callback function receiving the payload table
---@param options? table     -- Optional settings (e.g. { print = true } for debug logging)
---@return integer|false     -- Hook ID on success, false on failure
local hookId = exports['gcphone-next']:registerHook('messageSent', function(payload)
    -- payload contains event-specific data
    -- return false to cancel the action
    -- return anything else (or nil) to allow it
end)
```

### `removeHooks`

Remove hooks registered by the calling resource. If an `id` is provided, only that specific hook is removed. Otherwise, all hooks from the resource are removed.

```lua
---@param id? integer  -- Optional: specific hook ID to remove
exports['gcphone-next']:removeHooks()       -- remove all hooks from this resource
exports['gcphone-next']:removeHooks(hookId) -- remove a specific hook
```

### `triggerHook`

Trigger a hook event. Typically only called internally by gcphone-next, but exposed for advanced use cases.

```lua
---@param event string       -- One of the AllowedHooks names
---@param payload? table     -- Data passed to all registered callbacks
---@return boolean           -- false if any hook cancelled, true otherwise
local allowed = exports['gcphone-next']:triggerHook('messageSent', {
    source = source,
    identifier = identifier,
    message = messageData,
})
```

## Options

The `options` table passed to `registerHook` supports:

| Key | Type | Description |
|-----|------|-------------|
| `print` | `boolean` | When `true`, logs a message each time the hook is triggered (useful for debugging). |

Any additional keys in `options` are stored on the hook entry for custom use.

## Performance

- Hooks that take longer than **100ms** to execute will trigger a warning in the server console.
- Errors inside hook callbacks are caught with `pcall` and logged as warnings. They do not crash the server or block other hooks.

## Lua API (Internal)

For code running inside the gcphone-next resource, the hook functions are also available on the `GCPhone` global:

```lua
GCPhone.RegisterHook(event, cb, options)
GCPhone.TriggerHook(event, payload)
GCPhone.RemoveHooks(resourceName, id)
```

Legacy globals `RegisterPhoneHook`, `TriggerPhoneHook`, and `RemovePhoneHooks` are still available but deprecated.

## Example: Block calls to a specific number

```lua
-- In your external resource (server-side)
local hookId = exports['gcphone-next']:registerHook('numberDialed', function(payload)
    if payload.targetNumber == '555-0000' then
        -- Cancel the call
        return false
    end
end)

-- Later, to unregister:
exports['gcphone-next']:removeHooks(hookId)
```

## Example: Log all sent messages

```lua
exports['gcphone-next']:registerHook('messageSent', function(payload)
    print(('[AUDIT] %s sent message to %s'):format(
        payload.identifier or 'unknown',
        payload.message and payload.message.phoneNumber or 'unknown'
    ))
    -- Do not return false, so the message proceeds normally
end, { print = true })
```

## Example: Custom validation on contact add

```lua
exports['gcphone-next']:registerHook('contactAdded', function(payload)
    local contact = payload.contact
    if contact and contact.display and #contact.display > 50 then
        -- Reject contacts with names longer than 50 chars
        return false
    end
end)
```
