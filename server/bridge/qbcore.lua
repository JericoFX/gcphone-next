local Core = nil
local Framework = nil

local function safeScalar(query, values)
    local ok, result = pcall(function()
        return MySQL.scalar.await(query, values)
    end)
    if ok then
        return result
    end
    return nil
end

local function safeQuery(query, values)
    local ok, result = pcall(function()
        return MySQL.query.await(query, values)
    end)
    if ok then
        return result
    end
    return nil
end

local function ensureESXPhoneColumn()
    if Framework ~= 'esx' then return end

    -- Verified: ESX Legacy centers character data in `users`, but phone storage is not standardized in core docs.
    safeQuery('ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `phone_number` VARCHAR(10) NULL', {})
end

local function detectFramework()
    if GetResourceState('qb-core') == 'started' then
        Core = exports['qb-core']:GetCoreObject()
        Framework = 'qbcore'
        return true
    end

    if GetResourceState('qbx_core') == 'started' then
        Core = exports.qbx_core
        Framework = 'qbox'
        return true
    end

    if GetResourceState('es_extended') == 'started' then
        -- Verified: /esx-framework/esx-legacy-documentation server imports use exports["es_extended"]:getSharedObject().
        Core = exports['es_extended']:getSharedObject()
        Framework = 'esx'
        ensureESXPhoneColumn()
        return true
    end

    return false
end

CreateThread(function()
    while true do
        if detectFramework() then break end
        Wait(100)
    end

    if Framework then
        print(('[gcphone-next] Framework detected: %s'):format(Framework))
    else
        print('[gcphone-next] WARNING: No framework detected!')
    end
end)

local function IsTruthy(value)
    if value == true then return true end
    if type(value) == 'number' then return value ~= 0 end
    if type(value) == 'string' then
        local lower = value:lower()
        return lower == 'true' or lower == '1' or lower == 'yes'
    end
    return false
end

function GetFramework()
    return Framework
end

function GetPlayer(source)
    if not Core then return nil end

    if Framework == 'qbcore' or Framework == 'qbox' then
        return Core.Functions.GetPlayer(source)
    end

    if Framework == 'esx' then
        -- Verified: /esx-framework/esx-legacy-documentation uses ESX.GetPlayerFromId(playerId) for xPlayer retrieval.
        return Core.GetPlayerFromId(source)
    end

    return nil
end

function IsPlayerActionAllowed(source)
    local player = GetPlayer(source)
    if not player then return false, 'PLAYER_NOT_FOUND' end

    if Framework == 'qbcore' or Framework == 'qbox' then
        local metadata = (player.PlayerData and player.PlayerData.metadata) or {}
        local isDead = IsTruthy(metadata.isdead) or IsTruthy(metadata.dead)
        local inLastStand = IsTruthy(metadata.inlaststand)
        local isCuffed = IsTruthy(metadata.ishandcuffed) or IsTruthy(metadata.handcuffed) or IsTruthy(metadata.isHandcuffed)

        if isDead then return false, 'PLAYER_DEAD' end
        if inLastStand then return false, 'PLAYER_DOWN' end
        if isCuffed then return false, 'PLAYER_RESTRAINED' end

        return true, nil
    end

    if Framework == 'esx' then
        local state = Player(source).state
        local isDead = state and (IsTruthy(state.dead) or IsTruthy(state.isDead)) or false
        local isCuffed = state and (IsTruthy(state.handcuffed) or IsTruthy(state.isCuffed)) or false

        if isDead then return false, 'PLAYER_DEAD' end
        if isCuffed then return false, 'PLAYER_RESTRAINED' end

        return true, nil
    end

    return true, nil
end

function GetIdentifier(source)
    local allowed = IsPlayerActionAllowed(source)
    if not allowed then return nil end

    local player = GetPlayer(source)
    if not player then return nil end

    if Framework == 'qbcore' or Framework == 'qbox' then
        return player.PlayerData.citizenid
    end

    if Framework == 'esx' then
        return player.getIdentifier and player.getIdentifier() or player.identifier
    end

    return nil
end

function GetName(source)
    local player = GetPlayer(source)
    if not player then return nil end

    if Framework == 'qbcore' or Framework == 'qbox' then
        local charinfo = player.PlayerData.charinfo
        return charinfo.firstname .. ' ' .. charinfo.lastname
    end

    if Framework == 'esx' then
        -- Verified: /esx-framework/esx-legacy-documentation xPlayer.getName returns the RP/full player name.
        return player.getName and player.getName() or player.name
    end

    return nil
end

function GetMoney(source, accountType)
    local player = GetPlayer(source)
    if not player then return 0 end
    accountType = accountType or 'bank'

    if Framework == 'qbcore' or Framework == 'qbox' then
        return player.Functions.GetMoney(accountType) or 0
    end

    if Framework == 'esx' then
        if accountType == 'cash' or accountType == 'money' then
            return (player.getMoney and player.getMoney()) or 0
        end

        local account = player.getAccount and player.getAccount(accountType) or nil
        return account and account.money or 0
    end

    return 0
end

function AddMoney(source, amount, accountType, reason)
    local player = GetPlayer(source)
    if not player then return false end
    accountType = accountType or 'bank'
    reason = reason or 'gcphone'

    if Framework == 'qbcore' or Framework == 'qbox' then
        return player.Functions.AddMoney(accountType, amount, reason)
    end

    if Framework == 'esx' then
        if accountType == 'cash' or accountType == 'money' then
            -- Verified: /esx-framework/esx-legacy-documentation xPlayer.addMoney exists for money account.
            player.addMoney(amount, reason)
            return true
        end

        -- Verified: /esx-framework/esx-legacy-documentation xPlayer.addAccountMoney(account, amount, reason) is supported.
        player.addAccountMoney(accountType, amount, reason)
        return true
    end

    return false
end

function RemoveMoney(source, amount, accountType, reason)
    local player = GetPlayer(source)
    if not player then return false end
    accountType = accountType or 'bank'
    reason = reason or 'gcphone'

    if Framework == 'qbcore' or Framework == 'qbox' then
        return player.Functions.RemoveMoney(accountType, amount, reason)
    end

    if Framework == 'esx' then
        if accountType == 'cash' or accountType == 'money' then
            player.removeMoney(amount, reason)
            return true
        end

        -- Verified: /esx-framework/esx-legacy-documentation xPlayer.removeAccountMoney(account, amount, reason) is supported.
        player.removeAccountMoney(accountType, amount, reason)
        return true
    end

    return false
end

function GetJob(source)
    local player = GetPlayer(source)
    if not player then return nil end

    if Framework == 'qbcore' or Framework == 'qbox' then
        return player.PlayerData.job
    end

    if Framework == 'esx' then
        return player.getJob and player.getJob() or player.job
    end

    return nil
end

function GetSourceFromIdentifier(identifier)
    if not Core or not identifier then return nil end

    if Framework == 'qbcore' or Framework == 'qbox' then
        local players = Core.Functions.GetPlayers()
        for _, src in pairs(players) do
            local player = Core.Functions.GetPlayer(src)
            if player and player.PlayerData.citizenid == identifier then
                return tonumber(src)
            end
        end
        return nil
    end

    if Framework == 'esx' then
        -- Verified: /esx-framework/esx-legacy-documentation notes ESX.GetPlayerFromIdentifier(identifier) exists server-side.
        local xPlayer = Core.GetPlayerFromIdentifier and Core.GetPlayerFromIdentifier(identifier) or nil
        if xPlayer then
            return tonumber(xPlayer.source or xPlayer.getSource and xPlayer.getSource())
        end
    end

    return nil
end

local function getQBPhoneFromPlayer(player)
    local charinfo = player and player.PlayerData and player.PlayerData.charinfo or nil
    local phone = charinfo and charinfo.phone or nil
    if type(phone) == 'string' and phone ~= '' then
        return phone
    end
    return nil
end

local function getESXPhoneFromPlayer(player)
    if not player then return nil end

    local variables = player.variables or {}
    local phone = variables.phoneNumber or variables.phone_number or variables.phone
    if type(phone) == 'string' and phone ~= '' then
        return phone
    end

    if player.get then
        phone = player.get('phoneNumber') or player.get('phone_number') or player.get('phone')
        if type(phone) == 'string' and phone ~= '' then
            return phone
        end
    end

    return nil
end

function GetFrameworkPhoneNumber(source, identifier)
    local player = source and GetPlayer(source) or nil
    if not player and identifier then
        local onlineSource = GetSourceFromIdentifier(identifier)
        if onlineSource then
            player = GetPlayer(onlineSource)
        end
    end

    if Framework == 'qbcore' or Framework == 'qbox' then
        -- Verified: /qbcore player data docs list charinfo.phone as the generated player phone number.
        return getQBPhoneFromPlayer(player)
    end

    if Framework == 'esx' then
        local phone = getESXPhoneFromPlayer(player)
        if phone then return phone end

        if identifier then
            -- TODO: Verify exact ESX phone storage for this server once its phone resource/schema is chosen.
            phone = safeScalar('SELECT phone_number FROM users WHERE identifier = ? LIMIT 1', { identifier })
                or safeScalar('SELECT phone FROM users WHERE identifier = ? LIMIT 1', { identifier })
            if type(phone) == 'string' and phone ~= '' then
                return phone
            end
        end
    end

    return nil
end

function GetPhoneNumber(identifier)
    if not identifier then return nil end

    local frameworkPhone = GetFrameworkPhoneNumber(nil, identifier)
    if frameworkPhone then return frameworkPhone end

    return safeScalar(
        'SELECT phone_number FROM phone_numbers WHERE identifier = ? LIMIT 1',
        { identifier }
    )
end

function SetFrameworkPhoneNumber(source, identifier, phoneNumber)
    if type(phoneNumber) ~= 'string' or phoneNumber == '' then
        return false
    end

    if Framework == 'esx' then
        ensureESXPhoneColumn()
        local targetIdentifier = identifier
        if (not targetIdentifier or targetIdentifier == '') and source then
            targetIdentifier = GetIdentifier(source)
        end
        if not targetIdentifier then
            return false
        end

        return safeQuery('UPDATE `users` SET `phone_number` = ? WHERE `identifier` = ?', { phoneNumber, targetIdentifier }) ~= nil
    end

    return false
end

function GetIdentifierByPhone(phoneNumber)
    if not phoneNumber then return nil end

    if Framework == 'qbcore' or Framework == 'qbox' then
        local players = Core.Functions.GetPlayers()
        for _, src in pairs(players) do
            local player = Core.Functions.GetPlayer(src)
            if getQBPhoneFromPlayer(player) == phoneNumber then
                return player.PlayerData.citizenid
            end
        end
    elseif Framework == 'esx' then
        local players = Core.GetExtendedPlayers and Core.GetExtendedPlayers() or {}
        for _, xPlayer in pairs(players) do
            if getESXPhoneFromPlayer(xPlayer) == phoneNumber then
                return xPlayer.getIdentifier and xPlayer.getIdentifier() or xPlayer.identifier
            end
        end

        local identifier = safeScalar('SELECT identifier FROM users WHERE phone_number = ? LIMIT 1', { phoneNumber })
            or safeScalar('SELECT identifier FROM users WHERE phone = ? LIMIT 1', { phoneNumber })
        if identifier then
            return identifier
        end
    end

    return safeScalar(
        'SELECT identifier FROM phone_numbers WHERE phone_number = ? LIMIT 1',
        { phoneNumber }
    )
end
