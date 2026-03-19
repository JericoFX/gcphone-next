---
title: Framework Bridge
---

# Framework Bridge

gcphone-next uses a bridge pattern to abstract framework-specific logic. This allows the same server modules to work with QBCore, QBox, and ESX without conditional checks scattered throughout the codebase.

## How It Works

The bridge system has three layers:

1. **Config selection** -- `Config.Framework` in `shared/config.lua` determines which bridge loads.
2. **Bridge files** -- Each framework has a dedicated file that defines a set of global functions.
3. **Main orchestrator** -- `server/main.lua` waits for the framework to start, then builds a `Bridge` table from the global functions and exposes them as server exports.

### Loading Flow

When the resource starts:

1. `server/main.lua` loads and validates Config.
2. The bridge files (`server/bridge/qbcore.lua` and `server/bridge/esx.lua`) each check `Config.Framework` at the top and `return` immediately if they are not the active framework.
3. The active bridge file waits for its framework resource to start (using `lib.waitFor`), obtains the framework core object, and defines global functions.
4. `server/main.lua` waits for a supported framework resource to reach `started` state, then wraps the global functions into a `Bridge` table via `bridgeCall()`.

### Guard Clauses

Each bridge file starts with a guard:

```lua
-- qbcore.lua
if Config.Framework ~= 'qbcore' and Config.Framework ~= 'qbox' then return end

-- esx.lua
if Config.Framework ~= 'esx' then return end
```

Only one bridge ever executes its initialization logic.

## Supported Frameworks

| Framework | Config Value | Resource Name | Bridge File |
|---|---|---|---|
| QBCore | `'qbcore'` | `qb-core` | `server/bridge/qbcore.lua` |
| QBox | `'qbox'` | `qbx_core` | `server/bridge/qbcore.lua` (same file, detects both) |
| ESX | `'esx'` | `es_extended` | `server/bridge/esx.lua` |

The QBCore bridge handles both QBCore and QBox. It detects which is running at startup:

```lua
if GetResourceState('qb-core') == 'started' then
    Core = exports['qb-core']:GetCoreObject()
    Framework = 'qbcore'
elseif GetResourceState('qbx_core') == 'started' then
    Core = exports.qbx_core
    Framework = 'qbox'
end
```

## Bridge Functions

Each bridge must define these global functions. All server modules call them through `bridgeCall()` in `server/main.lua`.

### GetIdentifier(source)

Returns the player's unique identifier (citizenid for QBCore/QBox, license/identifier for ESX). Also checks if the player action is allowed (not dead, not cuffed).

- **QBCore**: `player.PlayerData.citizenid`
- **ESX**: `player.getIdentifier()` or `player.identifier`

### GetName(source)

Returns the player's character name.

- **QBCore**: `charinfo.firstname .. ' ' .. charinfo.lastname`
- **ESX**: `player.getName()` or `player.name`

### GetMoney(source, accountType)

Returns the player's money for the given account type (default: `'bank'`).

- **QBCore**: `player.Functions.GetMoney(accountType)`
- **ESX**: `player.getAccount(accountType).money` (or `player.getMoney()` for cash)

### AddMoney(source, amount, accountType, reason)

Adds money to the player's account. Returns `true` on success.

- **QBCore**: `player.Functions.AddMoney(accountType, amount, reason)`
- **ESX**: `player.addAccountMoney(accountType, amount, reason)` (or `player.addMoney()` for cash)

### RemoveMoney(source, amount, accountType, reason)

Removes money from the player's account. Returns `true` on success.

- **QBCore**: `player.Functions.RemoveMoney(accountType, amount, reason)`
- **ESX**: `player.removeAccountMoney(accountType, amount, reason)` (or `player.removeMoney()` for cash)

### GetJob(source)

Returns the player's job object.

- **QBCore**: `player.PlayerData.job`
- **ESX**: `player.getJob()` or `player.job`

### GetSourceFromIdentifier(identifier)

Finds the server source ID for an online player by their identifier. Returns `nil` if the player is offline.

- **QBCore**: Iterates `Core.Functions.GetPlayers()` and matches `citizenid`
- **ESX**: Uses `ESX.GetPlayerFromIdentifier(identifier)`

### IsPlayerActionAllowed(source)

Checks if the player can perform phone actions. Returns `true, nil` if allowed, or `false, reason` if blocked.

Checked states:
- Dead / last stand
- Handcuffed / restrained

- **QBCore**: Reads `player.PlayerData.metadata` for `isdead`, `inlaststand`, `ishandcuffed`
- **ESX**: Reads `Player(source).state` for `dead`, `isCuffed`, `handcuffed`

### GetFrameworkPhoneNumber(source, identifier)

Attempts to read the player's phone number from the framework's own data (e.g., QBCore's `charinfo.phone` or ESX's `users.phone_number` column). Falls back to `nil` if not available.

### GetPhoneNumber(identifier)

Returns a phone number for the given identifier. Tries `GetFrameworkPhoneNumber` first, then falls back to the `phone_numbers` database table.

### GetIdentifierByPhone(phoneNumber)

Reverse lookup: finds the identifier that owns a phone number. Checks online players first, then the database.

## Server Exports

`server/main.lua` exposes the bridge functions as resource exports so other resources can use them:

```lua
exports('GetIdentifier', function(source) ... end)
exports('GetName', function(source) ... end)
exports('GetMoney', function(source, accountType) ... end)
exports('AddMoney', function(source, amount, accountType, reason) ... end)
exports('RemoveMoney', function(source, amount, accountType, reason) ... end)
exports('GetJob', function(source) ... end)
exports('GetFramework', function() ... end)
exports('GetSourceFromIdentifier', function(identifier) ... end)
exports('IsPlayerActionAllowed', function(source) ... end)
exports('GetBridge', function() ... end)  -- Returns the full Bridge table
```

### Usage from another resource

```lua
local identifier = exports['gcphone-next']:GetIdentifier(source)
local name = exports['gcphone-next']:GetName(source)
local bankMoney = exports['gcphone-next']:GetMoney(source, 'bank')
```

## Adding a New Framework

To add support for a new framework:

1. Create a new bridge file at `server/bridge/yourframework.lua`.

2. Add a guard clause at the top:

   ```lua
   if Config.Framework ~= 'yourframework' then return end
   ```

3. Wait for your framework resource to start using `lib.waitFor`.

4. Define all the required global functions listed above (`GetIdentifier`, `GetName`, `GetMoney`, `AddMoney`, `RemoveMoney`, `GetJob`, `GetSourceFromIdentifier`, `IsPlayerActionAllowed`, `GetFrameworkPhoneNumber`, `GetPhoneNumber`, `GetIdentifierByPhone`).

5. Add the file to `fxmanifest.lua` in the `server_scripts` section:

   ```lua
   server_scripts {
       -- ... existing ...
       'server/bridge/yourframework.lua',
   }
   ```

6. Update `server/main.lua` to detect your framework resource in the startup `lib.waitFor` callback:

   ```lua
   lib.waitFor(function()
       if GetResourceState('qb-core') == 'started'
           or GetResourceState('qbx_core') == 'started'
           or GetResourceState('es_extended') == 'started'
           or GetResourceState('your_framework_resource') == 'started' then
           return true
       end
   end, 'gcphone-next failed to detect a supported framework', false)
   ```

7. Set `Config.Framework = 'yourframework'` in `shared/config.lua`.

No changes are needed in any server module -- they all go through `bridgeCall()` which resolves the global functions at runtime.
