-- Phone settings validators (pure helpers).
-- Extracted from server/modules/phone.lua (OPT-07 pass 2) to reduce file size.
-- All functions depend only on Config globals, no module state.

local M = {}

function M.SafeTheme(value)
    if value == 'auto' or value == 'light' or value == 'dark' then
        return value
    end
    return nil
end

function M.SafeAudioProfile(value)
    if value == 'normal' or value == 'street' or value == 'vehicle' or value == 'silent' then
        return value
    end
    return nil
end

function M.SafeToneId(value)
    if type(value) ~= 'string' then return nil end
    local tone = value:gsub('[^%w%._%-]', '')
    if tone == '' then return nil end
    return tone:sub(1, 64)
end

function M.NativeAudioDefaults()
    return (Config.NativeAudio and Config.NativeAudio.DefaultByCategory) or {}
end

function M.NativeAudioCatalog()
    return (Config.NativeAudio and Config.NativeAudio.Catalog) or {}
end

function M.NativeAudioLegacyMap()
    return (Config.NativeAudio and Config.NativeAudio.LegacyMap) or {}
end

function M.DefaultToneId(category)
    local defaults = M.NativeAudioDefaults()
    if category == 'ringtone' then
        return defaults.ringtone or 'call_1'
    end
    if category == 'notification' then
        return defaults.notification or 'notif_1'
    end
    if category == 'message' then
        return defaults.message or 'msg_1'
    end
    if category == 'vibrate' then
        return defaults.vibrate or 'buzz_short_01'
    end
    return defaults.ringtone or 'call_1'
end

function M.ResolveToneId(value, category)
    local tone = M.SafeToneId(value)
    local catalog = M.NativeAudioCatalog()
    local legacy = M.NativeAudioLegacyMap()
    local defaultTone = M.DefaultToneId(category)

    if not tone then return defaultTone end
    if catalog[tone] then return tone end

    local mapped = legacy[tone]
    if mapped and catalog[mapped] then
        return mapped
    end

    return defaultTone
end

function M.SafeLanguage(value)
    if type(value) ~= 'string' then return nil end

    local normalized = value:lower():gsub('%-', '_')
    if normalized == 'es' or normalized == 'es_es' then return 'es' end
    if normalized == 'en' or normalized == 'en_us' then return 'en' end
    if normalized == 'pt' or normalized == 'pt_br' then return 'pt' end
    if normalized == 'fr' or normalized == 'fr_fr' then return 'fr' end
    if normalized == 'de' or normalized == 'de_de' then return 'de' end
    if normalized == 'it' or normalized == 'it_it' then return 'it' end
    if normalized == 'pl' or normalized == 'pl_pl' then return 'pl' end
    if normalized == 'ru' or normalized == 'ru_ru' then return 'ru' end

    return nil
end

return M
