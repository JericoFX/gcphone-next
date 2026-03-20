GCPhone = GCPhone or {}
GCPhone.Utils = GCPhone.Utils or {}

GcPhoneUtils = GCPhone.Utils

local RESOURCE_NAME = GetCurrentResourceName()

function GcPhoneUtils.SafeString(value, maxLen)
    if type(value) ~= 'string' then return nil end

    local normalized = value:gsub('[%z\1-\31\127]', ''):gsub('^%s+', ''):gsub('%s+$', '')
    if normalized == '' then return nil end

    local limit = tonumber(maxLen)
    if limit and limit > 0 and #normalized > limit then
        normalized = normalized:sub(1, limit)
    end

    return normalized
end

function GcPhoneUtils.SanitizeText(value, maxLength, stripTags)
    if type(value) ~= 'string' then return '' end

    local text = value:gsub('[%z\1-\31\127]', '')
    if stripTags then
        text = text:gsub('<.->', '')
    end

    text = text:gsub('^%s+', ''):gsub('%s+$', '')

    local limit = tonumber(maxLength)
    if not limit or limit < 1 then
        return text
    end

    return text:sub(1, limit)
end

function GcPhoneUtils.SanitizeMediaUrl(value, allowedExt, maxLen)
    if type(value) ~= 'string' then return nil end

    local url = value:gsub('[%z\1-\31\127]', ''):gsub('^%s+', ''):gsub('%s+$', '')
    if url == '' then return nil end
    if not url:match('^https?://') then return nil end

    local base = (url:match('^[^?]+') or url):lower()
    if type(allowedExt) == 'table' and #allowedExt > 0 then
        local isAllowed = false
        for _, ext in ipairs(allowedExt) do
            if type(ext) == 'string' and base:sub(-#ext) == ext then
                isAllowed = true
                break
            end
        end
        if not isAllowed then
            return nil
        end
    end

    local limit = tonumber(maxLen)
    if limit and limit > 0 then
        return url:sub(1, limit)
    end

    return url
end

function GcPhoneUtils.GetRateLimitWindow(key, fallback)
    local rateLimits = Config and Config.Security and Config.Security.RateLimits or nil
    local value = tonumber(rateLimits and rateLimits[key]) or tonumber(fallback)
    if not value or value < 100 then
        value = tonumber(fallback) or 1000
    end
    return math.floor(value)
end

function GcPhoneUtils.HitRateLimit(source, key, windowMs, maxHits)
    local ok, blocked = pcall(function()
        return exports[RESOURCE_NAME]:HitRateLimit(source, key, windowMs, maxHits)
    end)

    if not ok then return false end
    return blocked == true
end
