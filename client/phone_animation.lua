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

        Wait(0)
    end

    loadedDicts[dict] = true
    return true
end

function PlayPhoneAnimation(anim)
    local ped = cache.ped
    if not ped or ped <= 0 then return false end

    local config = PHONE_ANIMATIONS[anim or 'text'] or PHONE_ANIMATIONS.text
    if config.clear then
        if type(SetPhoneVisualMode) == 'function' then
            SetPhoneVisualMode('text')
        end
        ClearPedSecondaryTask(ped)
        ClearPedTasks(ped)
        return true
    end

    if not EnsureAnimDict(config.dict) then
        return false
    end

    TaskPlayAnim(ped, config.dict, config.name, 8.0, -8.0, -1, config.flag or 50, 0.0, false, false, false)

    if type(SetPhoneVisualMode) == 'function' then
        if anim == 'call' then
            SetPhoneVisualMode('call')
        elseif anim == 'camera' then
            SetPhoneVisualMode('camera')
        elseif anim == 'live' then
            SetPhoneVisualMode('live')
        else
            SetPhoneVisualMode('text')
        end
    end

    return true
end

function PhonePlayIn()
    return PlayPhoneAnimation('in')
end

function PhonePlayOut()
    return PlayPhoneAnimation('out')
end

function PhonePlayCall()
    return PlayPhoneAnimation('call')
end

function PhonePlayText()
    return PlayPhoneAnimation('text')
end

function PhonePlayCamera()
    return PlayPhoneAnimation('camera')
end

function PhonePlayLive()
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
