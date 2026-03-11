local ESX = nil
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
    safeQuery('ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `phone_number` VARCHAR(10) NULL', {})
end

CreateThread(function()
    if GetResourceState('es_extended') == 'started' then
        ESX = exports['es_extended']:getSharedObject()
        Framework = 'esx'
        ensureESXPhoneColumn()
        print(('[gcphone-next] Framework detected: %s'):format(Framework))
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

function GetFramework()
    return Framework
end

function GetPlayer(source)
    if not ESX then return nil end
    return ESX.GetPlayerFromId(source)
end

function IsPlayerActionAllowed(source)
    local player = GetPlayer(source)
    if not player then return false, 'PLAYER_NOT_FOUND' end

    local state = Player(source).state
    local isDead = state and (IsTruthy(state.dead) or IsTruthy(state.isDead)) or false
    local isCuffed = state and (IsTruthy(state.handcuffed) or IsTruthy(state.isCuffed)) or false

    if isDead then return false, 'PLAYER_DEAD' end
    if isCuffed then return false, 'PLAYER_RESTRAINED' end

    return true, nil
end

function GetIdentifier(source)
    local allowed = IsPlayerActionAllowed(source)
    if not allowed then return nil end

    local player = GetPlayer(source)
    if not player then return nil end
    return player.getIdentifier and player.getIdentifier() or player.identifier
end

function GetName(source)
    local player = GetPlayer(source)
    if not player then return nil end
    return player.getName and player.getName() or player.name
end

function GetMoney(source, accountType)
    local player = GetPlayer(source)
    if not player then return 0 end
    accountType = accountType or 'bank'

    if accountType == 'cash' or accountType == 'money' then
        return (player.getMoney and player.getMoney()) or 0
    end

    local account = player.getAccount and player.getAccount(accountType) or nil
    return account and account.money or 0
end

function AddMoney(source, amount, accountType, reason)
    local player = GetPlayer(source)
    if not player then return false end
    accountType = accountType or 'bank'
    reason = reason or 'gcphone'

    if accountType == 'cash' or accountType == 'money' then
        player.addMoney(amount, reason)
        return true
    end

    player.addAccountMoney(accountType, amount, reason)
    return true
end

function RemoveMoney(source, amount, accountType, reason)
    local player = GetPlayer(source)
    if not player then return false end
    accountType = accountType or 'bank'
    reason = reason or 'gcphone'

    if accountType == 'cash' or accountType == 'money' then
        player.removeMoney(amount, reason)
        return true
    end

    player.removeAccountMoney(accountType, amount, reason)
    return true
end

function GetJob(source)
    local player = GetPlayer(source)
    if not player then return nil end
    return player.getJob and player.getJob() or player.job
end

function GetSourceFromIdentifier(identifier)
    if not ESX or not identifier then return nil end

    local xPlayer = ESX.GetPlayerFromIdentifier and ESX.GetPlayerFromIdentifier(identifier) or nil
    if xPlayer then
        return tonumber(xPlayer.source or xPlayer.getSource and xPlayer.getSource())
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

    local phone = getESXPhoneFromPlayer(player)
    if phone then return phone end

    if identifier then
        phone = safeScalar('SELECT phone_number FROM users WHERE identifier = ? LIMIT 1', { identifier })
            or safeScalar('SELECT phone FROM users WHERE identifier = ? LIMIT 1', { identifier })
        if type(phone) == 'string' and phone ~= '' then
            return phone
        end
    end

    return nil
end

function SetFrameworkPhoneNumber(source, identifier, phoneNumber)
    if type(phoneNumber) ~= 'string' or phoneNumber == '' then
        return false
    end

    ensureESXPhoneColumn()
    local targetIdentifier = identifier
    if (not targetIdentifier or targetIdentifier == '') and source then
        targetIdentifier = GetIdentifier(source)
    end
    if not targetIdentifier then
        return false
    end

    return safeQuery('UPDATE `users` SET `phone_number` = ? WHERE `identifier` = ?', { phoneNumber, targetIdentifier }) ~=
        nil
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

function GetIdentifierByPhone(phoneNumber)
    if not phoneNumber then return nil end

    if ESX then
        local players = ESX.GetExtendedPlayers and ESX.GetExtendedPlayers() or {}
        for _, xPlayer in pairs(players) do
            if getESXPhoneFromPlayer(xPlayer) == phoneNumber then
                return xPlayer.getIdentifier and xPlayer.getIdentifier() or xPlayer.identifier
            end
        end
    end

    local identifier = safeScalar('SELECT identifier FROM users WHERE phone_number = ? LIMIT 1', { phoneNumber })
        or safeScalar('SELECT identifier FROM users WHERE phone = ? LIMIT 1', { phoneNumber })
    if identifier then
        return identifier
    end

    return safeScalar(
        'SELECT identifier FROM phone_numbers WHERE phone_number = ? LIMIT 1',
        { phoneNumber }
    )
end
