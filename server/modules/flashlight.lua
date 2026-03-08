local function ClampNumber(value, minValue, maxValue)
    local num = tonumber(value) or minValue
    if num < minValue then return minValue end
    if num > maxValue then return maxValue end
    return math.floor(num + 0.5)
end

local function NormalizeFlashlightProfile(data)
    local cfg = Config.Flashlight or {}
    local kelvinCfg = cfg.Kelvin or {}
    local lumensCfg = cfg.Lumens or {}

    return {
        kelvin = ClampNumber(type(data) == 'table' and data.kelvin or nil, kelvinCfg.Default or 5200, kelvinCfg.Max or 9000),
        lumens = ClampNumber(type(data) == 'table' and data.lumens or nil, lumensCfg.Default or 1200, lumensCfg.Max or 2200),
    }
end

RegisterNetEvent('gcphone:stateChanged', function(open)
    local source = source
    local state = Player(source).state
    state:set('gcphoneOpen', open == true, true)
end)

RegisterNetEvent('gcphone:flashlight:setEnabled', function(enabled)
    local source = source
    local state = Player(source).state
    state:set('gcphoneFlashlight', enabled == true, true)
end)

RegisterNetEvent('gcphone:flashlight:setProfile', function(data)
    local source = source
    local state = Player(source).state
    local profile = NormalizeFlashlightProfile(data)
    state:set('gcphoneFlashlightProfile', json.encode(profile), true)
end)

AddEventHandler('playerDropped', function()
    local source = source
    local state = Player(source).state
    state:set('gcphoneFlashlight', false, true)
    state:set('gcphoneOpen', false, true)
    state:set('gcphoneFlashlightProfile', nil, true)
end)
