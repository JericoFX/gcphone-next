local phoneOwners = {}
local settingsCache = {}
local changedSettings = {}
local phoneObjects = {}
local latestVersion

-- String generation functions
function GenerateString(length)
    length = length or 15
    local result = ""

    for i = 1, length do
        if math.random(1, 2) == 1 then
            local char = string.char(math.random(97, 122))
            if math.random(1, 2) == 1 then
                char = char:upper()
            end
            result = result .. char
        else
            result = result .. math.random(1, 9)
        end
    end

    return result
end

function GenerateId(table, column)
    local id, exists

    repeat
        id = GenerateString(5)
        exists = MySQL.Sync.fetchScalar(("SELECT `%s` FROM `%s` WHERE `%s` = @id"):format(column, table, column),
            { ['@id'] = id })
        if exists then Wait(50) end
    until not exists

    return id
end

function GeneratePhoneNumber()
    local prefixes = Config.PhoneNumber.Prefixes
    local number, fullNumber, exists

    repeat
        number = ""
        for i = 1, Config.PhoneNumber.Length do
            number = number .. math.random(0, 9)
        end

        fullNumber = #prefixes == 0 and number or prefixes[math.random(1, #prefixes)] .. number
        exists = MySQL.Sync.fetchScalar("SELECT phone_number FROM phone_phones WHERE phone_number = @number",
            { ['@number'] = fullNumber })
        if exists then Wait(0) end
    until not exists

    return fullNumber
end

-- Settings management
function GetSettings(phoneNumber)
    return settingsCache[phoneNumber]
end

function SetSettings(phoneNumber, settings)
    if not settings then
        if changedSettings[phoneNumber] then
            changedSettings[phoneNumber] = nil
            if Config.CacheSettings ~= false then
                debugprint("Updating settings in database for " .. phoneNumber)
                MySQL.update("UPDATE phone_phones SET settings = ? WHERE phone_number = ?",
                    { json.encode(settingsCache[phoneNumber]), phoneNumber })
            end
        end
    end
    settingsCache[phoneNumber] = settings
end

function SaveAllSettings()
    if Config.CacheSettings == false then return end

    infoprint("info", "Saving all settings")

    for phoneNumber, settings in pairs(settingsCache) do
        if changedSettings[phoneNumber] then
            MySQL.update("UPDATE phone_phones SET settings = ? WHERE phone_number = ?",
                { json.encode(settings), phoneNumber })
        else
            debugprint("Not saving settings for " .. phoneNumber .. " because no changes were made")
        end
    end
end

-- Phone management
function GetEquippedPhoneNumber(source, callback)
    for phoneNumber, src in pairs(phoneOwners) do
        if src == source then
            if callback then callback(phoneNumber) end
            return phoneNumber
        end
    end
end

function GetSourceFromNumber(phoneNumber)
    return phoneNumber and phoneOwners[phoneNumber] or false
end

exports("GetSourceFromNumber", GetSourceFromNumber)

-- Callbacks and events
RegisterLegacyCallback("playerLoaded", function(source, cb)
    local identifier = GetIdentifier(source)
    debugprint(("%s %s %s triggered phone:playerLoaded"):format(GetPlayerName(source), source, identifier))

    if not Config.Item.Unique then
        local phoneNumber = MySQL.scalar.await("SELECT phone_number FROM phone_phones WHERE id = ?", { identifier })
        if phoneNumber and HasPhoneItem(source, phoneNumber) then
            phoneOwners[phoneNumber] = source
            MySQL.update("UPDATE phone_phones SET last_seen = CURRENT_TIMESTAMP WHERE phone_number = ?", { phoneNumber })
            return cb(phoneNumber)
        end
        return cb(phoneNumber)
    end

    local lastPhone = MySQL.scalar.await("SELECT phone_number FROM phone_last_phone WHERE id = ?", { identifier })
    debugprint("result from phone_last_phone: " .. tostring(lastPhone))

    if lastPhone then
        if HasPhoneItem(source, lastPhone) then
            debugprint(source .. "has phone with metadata")
            phoneOwners[lastPhone] = source
            MySQL.update("UPDATE phone_phones SET last_seen = CURRENT_TIMESTAMP WHERE phone_number = ?", { lastPhone })
            return cb(lastPhone)
        end
        debugprint(source .. " doesn't have phone with metadata for last phone number equipped")
        return cb()
    end

    if not HasPhoneItem(source) then
        debugprint(source .. " does not have an empty phone")
        return cb()
    end

    local existingPhone = MySQL.scalar.await("SELECT phone_number FROM phone_phones WHERE id = ? AND assigned = FALSE",
        { identifier })
    if not existingPhone or not SetPhoneNumber(source, existingPhone) then
        debugprint(source ..
        " does not have an existing phone from pre-unique phone, or failed to set number to item metadata")
        return cb()
    end

    MySQL.update("UPDATE phone_phones SET assigned = TRUE, last_seen = CURRENT_TIMESTAMP WHERE phone_number = ?",
        { existingPhone })
    MySQL.update("INSERT INTO phone_last_phone (id, phone_number) VALUES (?, ?)", { identifier, existingPhone })
    phoneOwners[existingPhone] = source
    cb(existingPhone)
end)

RegisterLegacyCallback("setLastPhone", function(source, cb, phoneNumber)
    local identifier = GetIdentifier(source)
    local currentPhone = GetEquippedPhoneNumber(source)
    SaveBattery(source)

    if not phoneNumber then
        MySQL.update("DELETE FROM phone_last_phone WHERE id = ?", { identifier })
        if currentPhone then
            phoneOwners[currentPhone] = nil
            local playerState = Player(source).state
            playerState.phoneOpen = false
            playerState.phoneName = nil
            playerState.phoneNumber = nil

            if GetSettings(currentPhone) then
                SetSettings(currentPhone, nil)
            end
        end
        return cb()
    end

    if phoneOwners[phoneNumber] and phoneOwners[phoneNumber] ~= source then
        return cb()
    end

    if not MySQL.scalar.await("SELECT 1 FROM phone_phones WHERE phone_number = ?", { phoneNumber }) then
        infoprint("warning", ("%s | %s tried to use a phone with a number that doesn't exist. Phone number: %s"):format(
            GetPlayerName(source), source, phoneNumber))
        return cb()
    end

    MySQL.update.await(
        "INSERT INTO phone_last_phone (id, phone_number) VALUES (?, ?) ON DUPLICATE KEY UPDATE phone_number = ?",
        { identifier, phoneNumber, phoneNumber })

    if currentPhone then
        phoneOwners[currentPhone] = nil
        if GetSettings(currentPhone) then
            SetSettings(currentPhone, nil)
        end
    end

    phoneOwners[phoneNumber] = source
    cb()
end)

RegisterLegacyCallback("generatePhoneNumber", function(source, cb)
    local identifier = GetIdentifier(source)
    local id = identifier
    debugprint(("%s %s %s wants to generate a phone number"):format(GetPlayerName(source), source, identifier))

    if Config.Item.Unique then
        if not HasPhoneItem(source) then
            debugprint(GetPlayerName(source) .. " does not have a phone item without a number assigned")
            return cb()
        end
        id = GenerateId("phone_phones", "id")
    else
        local existingNumber = MySQL.scalar.await("SELECT phone_number FROM phone_phones WHERE id = ?", { identifier })
        if existingNumber then
            infoprint("warning", GetPlayerName(source) .. " wants to generate a phone number, but they already have one.")
            phoneOwners[existingNumber] = source
            return cb(existingNumber)
        end
    end

    local phoneNumber = GeneratePhoneNumber()
    MySQL.update.await("INSERT INTO phone_phones (id, owner_id, phone_number) VALUES (?, ?, ?)",
        { id, identifier, phoneNumber })
    TriggerEvent("lb-phone:phoneNumberGenerated", source, phoneNumber)

    if Config.Item.Unique then
        SetPhoneNumber(source, phoneNumber)
        MySQL.update.await("UPDATE phone_phones SET assigned = TRUE WHERE phone_number = ?", { phoneNumber })
        MySQL.update.await(
            "INSERT INTO phone_last_phone (id, phone_number) VALUES (?, ?) ON DUPLICATE KEY UPDATE phone_number = ?",
            { GetIdentifier(source), phoneNumber, phoneNumber })
    end

    phoneOwners[phoneNumber] = source
    cb(phoneNumber)
end)

RegisterLegacyCallback("getPhone", function(source, cb, phoneNumber)
    debugprint(GetPlayerName(source) .. " triggered phone:getPhone. checking if they have an item")

    if not HasPhoneItem(source, phoneNumber) then
        debugprint(GetPlayerName(source) .. "does not have an item")
        return cb()
    end

    local phoneData = MySQL.single.await(
    "SELECT owner_id, is_setup, settings, `name`, battery FROM phone_phones WHERE phone_number = ?", { phoneNumber })
    if not phoneData then
        debugprint(GetPlayerName(source) .. "does not have any phone data")
        return cb()
    end

    if phoneData.settings then
        local cachedSettings = GetSettings(phoneNumber)
        phoneData.settings = cachedSettings or json.decode(phoneData.settings)
        if not cachedSettings then
            SetSettings(phoneNumber, phoneData.settings)
        end
    end

    if not phoneData.owner_id then
        debugprint(("%s's phone does not have an owner, setting owner to %s"):format(GetPlayerName(source),
            GetIdentifier(source)))
        MySQL.update("UPDATE phone_phones SET owner_id = ? WHERE phone_number = ?", { GetIdentifier(source), phoneNumber })
    end

    cb(phoneData)
end)

RegisterLegacyCallback("isAdmin", function(source, cb)
    cb(IsAdmin(source))
end)

RegisterLegacyCallback("getCharacterName", function(source, cb)
    local firstname, lastname = GetCharacterName(source)
    cb({ firstname = firstname, lastname = lastname })
end)

-- Version check
PerformHttpRequest("https://loaf-scripts.com/versions/phone/version.json", function(status, body, headers, error)
    if status ~= 200 then
        debugprint("Failed to get latest script version", "Status:", status, "Body:", body, "Headers:", headers, "Error:",
            error)
        return
    end
    latestVersion = json.decode(body).latest
end, "GET")

RegisterCallback("getLatestVersion", function()
    return latestVersion
end)

-- Phone setup events
RegisterNetEvent("phone:finishedSetup", function(settings)
    local source = source
    local phoneNumber = GetEquippedPhoneNumber(source)
    if not phoneNumber then return end

    SetSettings(phoneNumber, false)
    MySQL.update("UPDATE phone_phones SET is_setup = true, settings = ? WHERE phone_number = ?",
        { json.encode(settings), phoneNumber })

    if Config.AutoCreateEmail then
        GenerateEmailAccount(source, phoneNumber)
    end
end)

RegisterNetEvent("phone:setName", function(name)
    local source = source
    local phoneNumber = GetEquippedPhoneNumber(source)
    if not phoneNumber then return end

    MySQL.Async.execute("UPDATE phone_phones SET `name`=@name WHERE phone_number=@phoneNumber", {
        ['@phoneNumber'] = phoneNumber,
        ['@name'] = name
    })

    if Config.Item.Unique and SetItemName then
        SetItemName(source, phoneNumber, name)
    end

    Player(source).state.phoneName = name
end)

RegisterCallback("setSettings", function(source, setting)
    local phoneNumber = GetEquippedPhoneNumber(source)
    if not phoneNumber then return end
    debugprint(source, "saving settings for phone number", phoneNumber)
    changedSettings[phoneNumber] = true
    SetSettings(phoneNumber, setting)
    if Config.CacheSettings == false then
        MySQL.update("UPDATE phone_phones SET settings = ? WHERE phone_number = ?", { json.encode(setting), phoneNumber })
    end
end)

RegisterNetEvent("phone:togglePhone", function(open, name)
    local source = source
    local playerState = Player(source).state
    playerState.phoneOpen = open

    local phoneNumber = GetEquippedPhoneNumber(source)
    if phoneNumber then
        playerState.phoneName = name
        playerState.phoneNumber = phoneNumber
    end
end)

RegisterNetEvent("phone:toggleFlashlight", function(toggle)
    Player(source).state.flashlight = toggle
end)

RegisterNetEvent("phone:setPhoneObject", function(netId)
    local source = source
    if Config.ServerSideSpawn and not netId and phoneObjects[source] then
        debugprint("Deleting phone object for player " .. source)
        DeleteEntity(NetworkGetEntityFromNetworkId(phoneObjects[source]))
    end
    phoneObjects[source] = netId
end)

-- Cleanup handlers
AddEventHandler("playerDropped", function()
    local source = source
    local phoneObject = phoneObjects[source]
    local phoneNumber = GetEquippedPhoneNumber(source)

    if phoneObject then
        local entity = NetworkGetEntityFromNetworkId(phoneObject)
        if entity then DeleteEntity(entity) end
        phoneObjects[source] = nil
    end

    if phoneNumber then
        Wait(1000)
        SetSettings(phoneNumber, nil)
        phoneOwners[phoneNumber] = nil
    end
end)

AddEventHandler("onResourceStop", function(resource)
    if resource ~= GetCurrentResourceName() then return end

    for _, netId in pairs(phoneObjects) do
        local entity = NetworkGetEntityFromNetworkId(netId)
        if entity then DeleteEntity(entity) end
    end

    SaveAllSettings()
end)

AddEventHandler("txAdmin:events:serverShuttingDown", SaveAllSettings)

-- Factory reset
function FactoryReset(phoneNumber)
    MySQL.update.await("DELETE FROM phone_logged_in_accounts WHERE phone_number = ?", { phoneNumber })
    local success = MySQL.update.await(
    "UPDATE phone_phones SET is_setup = false, settings = NULL, pin = NULL, face_id = NULL WHERE phone_number = ?",
        { phoneNumber }) > 0

    if success and phoneOwners[phoneNumber] then
        TriggerClientEvent("phone:factoryReset", phoneOwners[phoneNumber])
        SetSettings(phoneNumber, nil)
        phoneOwners[phoneNumber] = nil
    end
end

RegisterNetEvent("phone:factoryReset", function()
    local phoneNumber = GetEquippedPhoneNumber(source)
    if phoneNumber then FactoryReset(phoneNumber) end
end)

exports("FactoryReset", FactoryReset)
