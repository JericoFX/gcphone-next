local Core = nil
local Framework = nil

CreateThread(function()
    -- Verified: CommunityOX ox_lib WaitFor/Shared supports indefinite waits with timeout = false
    local framework = lib.waitFor(function()
        if GetResourceState('qb-core') == 'started' then
            return 'qbcore'
        end

        if GetResourceState('qbx_core') == 'started' then
            return 'qbox'
        end
    end, 'gcphone-next failed to initialize QB/Qbox bridge', false)

    if framework == 'qbcore' then
        Core = exports['qb-core']:GetCoreObject()
        Framework = 'qbcore'
    elseif framework == 'qbox' then
        Core = exports.qbx_core
        Framework = 'qbox'
    end

    if Framework then
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

local function GetQBPhoneFromPlayer(player)
    local charinfo = player and player.PlayerData and player.PlayerData.charinfo or nil
    local phone = charinfo and charinfo.phone or nil
    if type(phone) == 'string' and phone ~= '' then
        return phone
    end
    return nil
end

function GetFramework()
    return Framework
end

function GetPlayer(source)
    if not Core then return nil end
    return Core.Functions.GetPlayer(source)
end

function IsPlayerActionAllowed(source)
    local player = GetPlayer(source)
    if not player then return false, 'PLAYER_NOT_FOUND' end

    local metadata = (player.PlayerData and player.PlayerData.metadata) or {}
    local isDead = (IsTruthy(metadata.isdead) or IsTruthy(metadata.dead)) or Player(source).inLastStand
    local inLastStand = IsTruthy(metadata.inlaststand)
    local isCuffed = IsTruthy(metadata.ishandcuffed) or IsTruthy(metadata.handcuffed) or IsTruthy(metadata.isHandcuffed)

    if isDead then return false, 'PLAYER_DEAD' end
    if inLastStand then return false, 'PLAYER_DOWN' end
    if isCuffed then return false, 'PLAYER_RESTRAINED' end

    return true, nil
end

function GetIdentifier(source)
    local allowed = IsPlayerActionAllowed(source)
    if not allowed then return nil end

    local player = GetPlayer(source)
    if not player then return nil end
    return player.PlayerData.citizenid
end

function GetName(source)
    local player = GetPlayer(source)
    if not player then return nil end
    local charinfo = player.PlayerData.charinfo
    return charinfo.firstname .. ' ' .. charinfo.lastname
end

function GetMoney(source, accountType)
    local player = GetPlayer(source)
    if not player then return 0 end
    accountType = accountType or 'bank'
    return player.Functions.GetMoney(accountType) or 0
end

function AddMoney(source, amount, accountType, reason)
    local player = GetPlayer(source)
    if not player then return false end
    accountType = accountType or 'bank'
    reason = reason or 'gcphone'
    return player.Functions.AddMoney(accountType, amount, reason)
end

function RemoveMoney(source, amount, accountType, reason)
    local player = GetPlayer(source)
    if not player then return false end
    accountType = accountType or 'bank'
    reason = reason or 'gcphone'
    return player.Functions.RemoveMoney(accountType, amount, reason)
end

function GetJob(source)
    local player = GetPlayer(source)
    if not player then return nil end
    return player.PlayerData.job
end

function GetSourceFromIdentifier(identifier)
    if not Core or not identifier then return nil end

    local players = Core.Functions.GetPlayers()
    for _, src in pairs(players) do
        local player = Core.Functions.GetPlayer(src)
        if player and player.PlayerData.citizenid == identifier then
            return tonumber(src)
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
    return GetQBPhoneFromPlayer(player)
end

function GetPhoneNumber(identifier)
    if not identifier then return nil end

    local frameworkPhone = GetFrameworkPhoneNumber(nil, identifier)
    if frameworkPhone then return frameworkPhone end

    return MySQL.scalar.await(
        'SELECT phone_number FROM phone_numbers WHERE identifier = ? LIMIT 1',
        { identifier }
    )
end

function GetIdentifierByPhone(phoneNumber)
    if not phoneNumber then return nil end

    if Core then
        if Core.Functions.GetPlayerByPhone then
            local player = Core.Functions.GetPlayerByPhone(phoneNumber)
            if player and player.PlayerData then
                return player.PlayerData.citizenid
            end
        end

        local players = Core.Functions.GetPlayers()
        for _, src in pairs(players) do
            local player = Core.Functions.GetPlayer(src)
            if GetQBPhoneFromPlayer(player) == phoneNumber then
                return player.PlayerData.citizenid
            end
        end
    end

    return MySQL.scalar.await(
        'SELECT identifier FROM phone_numbers WHERE phone_number = ? LIMIT 1',
        { phoneNumber }
    )
end
