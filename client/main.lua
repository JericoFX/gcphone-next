local PhoneState = require 'client.state'

-- Default timeout shim for lib.callback: replaces `false` (wait forever) with
-- Config.Callbacks.DefaultTimeoutMs. `lib` is resource-local in ox_lib, so this
-- patch only affects this resource.
do
    local original = lib.callback
    local defaultTimeoutMs = (Config.Callbacks and tonumber(Config.Callbacks.DefaultTimeoutMs)) or 15000
    lib.callback = setmetatable({}, {
        __call = function(_, name, timeout, cb, ...)
            if timeout == false then timeout = defaultTimeoutMs end
            return original(name, timeout, cb, ...)
        end,
        __index = original,
    })
end

---@alias GCPhoneNotificationPriority 'low'|'normal'|'high'

---@class GCPhoneNotificationPayload
---@field id? string Stable notification id. Duplicates are ignored by the UI queue.
---@field appId? string App identifier used by mute filters and unread tracking.
---@field title string Notification title.
---@field message string Notification message body.
---@field icon? string Short glyph or icon text rendered in the banner.
---@field durationMs? integer Auto-dismiss duration in milliseconds. Ignored when sticky is true.
---@field sticky? boolean Keeps the notification visible until manually dismissed.
---@field priority? GCPhoneNotificationPriority High bypasses DND/mute filters where supported by the UI.
---@field route? string Route opened when the user taps the notification.
---@field data? table<string, any> Optional route payload passed to the app router.
---@field createdAt? integer Unix ms timestamp used for ordering.

local NuiToken = nil
local NuiLastSeq = 0

local function CreateNuiAuthToken()
    local now = GetGameTimer() or 0
    local a = math.random(100000, 999999)
    local b = math.random(100000, 999999)
    return ('%d-%d-%d'):format(now, a, b)
end

local function BuildNuiSignature(token, seq, eventName)
    local input = ('%s|%s|%s'):format(token, seq, eventName)
    local hash = 2166136261

    for i = 1, #input do
        hash = (hash ~ string.byte(input, i)) & 0xffffffff
        hash = (hash * 16777619) & 0xffffffff
    end

    return string.format('%08x', hash)
end

local function RotateNuiAuthToken()
    NuiToken = CreateNuiAuthToken()
    NuiLastSeq = 0
    return NuiToken
end

local function GetNuiAuthToken()
    if not NuiToken then
        NuiToken = CreateNuiAuthToken()
    end
    return NuiToken
end

local UnprotectedNuiCallbacks = {
    nuiReady = true,
}

local NativeRegisterNUICallback = RegisterNUICallback

RegisterNUICallback = function(name, handler)
    NativeRegisterNUICallback(name, function(rawData, cb)
        local payload = rawData
        local providedToken = nil
        local providedSeq = nil
        local providedSig = nil

        if type(rawData) == 'table' and type(rawData._gc) == 'table' then
            payload = rawData.data
            providedToken = rawData._gc.token
            providedSeq = tonumber(rawData._gc.seq)
            providedSig = rawData._gc.sig
        end

        if payload == nil then
            payload = {}
        end

        if not UnprotectedNuiCallbacks[name] then
            local expectedToken = GetNuiAuthToken()
            if not PhoneState.isOpen then
                cb({ success = false, message = 'PHONE_CLOSED' })
                return
            end

            if type(providedToken) ~= 'string' or providedToken ~= expectedToken then
                cb({ success = false, message = 'UNAUTHORIZED' })
                return
            end

            if not providedSeq or providedSeq <= NuiLastSeq then
                cb({ success = false, message = 'UNAUTHORIZED' })
                return
            end

            local expectedSig = BuildNuiSignature(expectedToken, providedSeq, name)
            if type(providedSig) ~= 'string' or providedSig ~= expectedSig then
                cb({ success = false, message = 'UNAUTHORIZED' })
                return
            end

            NuiLastSeq = providedSeq
        end

        local ok, err = pcall(handler, payload, cb)
        if not ok then
            print(('[gcphone:nui] callback "%s" failed: %s'):format(tostring(name), tostring(err)))
            cb({ success = false, message = 'CALLBACK_FAILED' })
        end
    end)
end

-- NUI mount race: on cold connect the `initPhone` SendNUIMessage can fire
-- before the Vue/React frame has bound its listeners, causing the phone to
-- start blank. Buffer the most recent init payload until the NUI signals
-- `nuiReady`, then flush. Subsequent inits (multichar switch, live config
-- update) send through immediately since NUI is already mounted.
local nuiIsReady = false
local pendingInit = nil

local function ApplyPhoneInit(data)
    if type(data) ~= 'table' then return end
    PhoneState.phoneNumber = data.phoneNumber
    PhoneState.wallpaper = data.wallpaper
    PhoneState.ringtone = data.ringtone
    PhoneState.callRingtone = data.callRingtone or data.ringtone
    PhoneState.notificationTone = data.notificationTone
    PhoneState.messageTone = data.messageTone
    PhoneState.volume = data.volume
    PhoneState.lockCode = data.lockCode
    PhoneState.language = data.language
    PhoneState.audioProfile = data.audioProfile
    data.nuiAuthToken = RotateNuiAuthToken()

    if not nuiIsReady then
        pendingInit = data
        return
    end

    SendNUIMessage({
        action = 'initPhone',
        data = data
    })
end

RegisterNetEvent('gcphone:init', ApplyPhoneInit)

-- Client-driven fetch on character-load. Covers multichar (ESX/QBCore/QBox)
-- where the server-side playerLoaded event may race the bridge's framework init.
local function FetchPhoneOnCharacterReady()
    lib.callback('gcphone:getPhoneData', false, function(data)
        if data and not data.blocked then
            ApplyPhoneInit(data)
        end
    end)
end

RegisterNetEvent('esx:playerLoaded', FetchPhoneOnCharacterReady)
RegisterNetEvent('QBCore:Client:OnPlayerLoaded', FetchPhoneOnCharacterReady)

RegisterNUICallback('nuiReady', function(_, cb)
    nuiIsReady = true

    if pendingInit then
        local data = pendingInit
        pendingInit = nil
        SendNUIMessage({
            action = 'initPhone',
            data = data
        })
    end

    cb(true)
end)

---@param payload GCPhoneNotificationPayload
---@return boolean
local function PushPhoneNotification(payload)
    if type(payload) ~= 'table' then return false end
    SendNUIMessage({
        action = 'phone:notification',
        data = payload
    })
    return true
end

RegisterNetEvent('gcphone:notify', function(payload)
    PushPhoneNotification(payload)
end)

exports('GetPhoneState', function()
    return {
        isOpen = PhoneState.isOpen,
        phoneNumber = PhoneState.phoneNumber,
        hasFocus = PhoneState.hasFocus,
        useMouse = PhoneState.useMouse,
        airplaneMode = PhoneState.airplaneMode,
    }
end)

exports('IsPhoneOpen', function()
    return PhoneState.isOpen
end)

---Push a local phone notification directly from client Lua.
---Use this for client-side only UX. For cross-resource server notifications, prefer `SendPhoneNotification` server export.
---@param payload GCPhoneNotificationPayload
---@return boolean
exports('NotifyPhone', function(payload)
    return PushPhoneNotification(payload)
end)

return {
    PhoneState = PhoneState,
    RotateNuiAuthToken = RotateNuiAuthToken,
    GetNuiAuthToken = GetNuiAuthToken,
}
