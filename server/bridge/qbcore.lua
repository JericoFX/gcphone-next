local QBCore = nil
local Framework = nil

CreateThread(function()
    while true do
        if GetResourceState('qb-core') == 'started' then
            QBCore = exports['qb-core']:GetCoreObject()
            Framework = 'qbcore'
            break
        elseif GetResourceState('qbx_core') == 'started' then
            QBCore = exports.qbx_core
            Framework = 'qbox'
            break
        end
        Wait(100)
    end
    
    if Framework then
        print(('[gcphone-next] Framework detected: %s'):format(Framework))
    else
        print('[gcphone-next] WARNING: No framework detected!')
    end
end)

function GetPlayer(source)
    if not QBCore then return nil end
    return QBCore.Functions.GetPlayer(source)
end

local function IsTruthy(value)
    if value == true then return true end
    if type(value) == 'number' then return value ~= 0 end
    if type(value) == 'string' then
        local lower = value:lower()
        return lower == 'true' or lower == '1' or lower == 'yes'
    end
    return false
end

function IsPlayerActionAllowed(source)
    local player = GetPlayer(source)
    if not player then return false, 'PLAYER_NOT_FOUND' end

    local metadata = (player.PlayerData and player.PlayerData.metadata) or {}
    local isDead = IsTruthy(metadata.isdead) or IsTruthy(metadata.dead)
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
    if not QBCore then return nil end
    
    local players = QBCore.Functions.GetPlayers()
    
    for _, src in pairs(players) do
        local player = QBCore.Functions.GetPlayer(src)
        if player and player.PlayerData.citizenid == identifier then
            return tonumber(src)
        end
    end
    
    return nil
end

function GetPhoneNumber(identifier)
    if not identifier then return nil end
    
    return MySQL.scalar.await(
        'SELECT phone_number FROM phone_numbers WHERE identifier = ?',
        { identifier }
    )
end

function GetIdentifierByPhone(phoneNumber)
    if not phoneNumber then return nil end
    
    return MySQL.scalar.await(
        'SELECT identifier FROM phone_numbers WHERE phone_number = ?',
        { phoneNumber }
    )
end
