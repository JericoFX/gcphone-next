local PHONE_ANIMATIONS = {
    ['in'] = { dict = 'cellphone@', name = 'cellphone_text_in', flag = 50 },
    ['out'] = { clear = true },
    ['call'] = { dict = 'cellphone@', name = 'cellphone_call_to_text', flag = 50 },
    ['text'] = { dict = 'cellphone@', name = 'cellphone_text_in', flag = 50 },
    ['camera'] = { dict = 'cellphone@self', name = 'selfie_in', flag = 50 },
    ['live'] = { dict = 'cellphone@self', name = 'selfie_in', flag = 50 },
}

local loadedDicts = {}

local function EnsureAnimDict(dict)
    if loadedDicts[dict] then return true end

    RequestAnimDict(dict)
    local timeoutAt = GetGameTimer() + 5000
    while not HasAnimDictLoaded(dict) do
        if GetGameTimer() >= timeoutAt then
            return false
        end

        Wait(10)
    end

    loadedDicts[dict] = true
    return true
end

local function PlayPhoneAnimation(anim)
    local ped = cache.ped
    if not ped or ped <= 0 then return false end

    -- Lazy require to break phone_animation <-> phone cycle
    local PhoneMod = require 'client.phone'

    local config = PHONE_ANIMATIONS[anim or 'text'] or PHONE_ANIMATIONS.text
    if config.clear then
        PhoneMod.SetPhoneVisualMode('text')
        ClearPedSecondaryTask(ped)
        ClearPedTasks(ped)
        return true
    end

    if not EnsureAnimDict(config.dict) then
        return false
    end

    TaskPlayAnim(ped, config.dict, config.name, 8.0, -8.0, -1, config.flag or 50, 0.0, false, false, false)

    if anim == 'call' then
        PhoneMod.SetPhoneVisualMode('call')
    elseif anim == 'camera' then
        PhoneMod.SetPhoneVisualMode('camera')
    elseif anim == 'live' then
        PhoneMod.SetPhoneVisualMode('live')
    else
        PhoneMod.SetPhoneVisualMode('text')
    end

    return true
end

local function PhonePlayIn()
    return PlayPhoneAnimation('in')
end

local function PhonePlayOut()
    return PlayPhoneAnimation('out')
end

local function PhonePlayCall()
    return PlayPhoneAnimation('call')
end

local function PhonePlayText()
    return PlayPhoneAnimation('text')
end

local function PhonePlayCamera()
    return PlayPhoneAnimation('camera')
end

local function PhonePlayLive()
    return PlayPhoneAnimation('live')
end

---@alias GCPhoneAnimationMode 'in'|'out'|'call'|'text'|'camera'|'live'

---Play a phone animation by logical mode.
---@param mode GCPhoneAnimationMode|string
---@return boolean
exports('PlayPhoneAnimation', PlayPhoneAnimation)

---@return boolean
exports('PhonePlayIn', PhonePlayIn)

---@return boolean
exports('PhonePlayOut', PhonePlayOut)

---@return boolean
exports('PhonePlayCall', PhonePlayCall)

---@return boolean
exports('PhonePlayText', PhonePlayText)

---@return boolean
exports('PhonePlayCamera', PhonePlayCamera)

---@return boolean
exports('PhonePlayLive', PhonePlayLive)

return {
    PlayPhoneAnimation = PlayPhoneAnimation,
    PhonePlayIn = PhonePlayIn,
    PhonePlayOut = PhonePlayOut,
    PhonePlayCall = PhonePlayCall,
    PhonePlayText = PhonePlayText,
    PhonePlayCamera = PhonePlayCamera,
    PhonePlayLive = PhonePlayLive,
}
