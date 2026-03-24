local M = {}
local RESOURCE_NAME = GetCurrentResourceName()

--- oxmysql may return TINYINT(1) as boolean instead of number.
---@param val any
---@return boolean
function M.isTruthy(val)
    return val == true or tonumber(val) == 1
end

---Trim control chars and whitespace, return nil if empty.
---@param value any
---@param maxLen? number
---@return string|nil
function M.SafeString(value, maxLen)
    if type(value) ~= 'string' then return nil end

    local normalized = value:gsub('[%z\1-\31\127]', ''):gsub('^%s+', ''):gsub('%s+$', '')
    if normalized == '' then return nil end

    local limit = tonumber(maxLen)
    if limit and limit > 0 and #normalized > limit then
        normalized = normalized:sub(1, limit)
    end

    return normalized
end

---Sanitize text: strip control chars, optionally HTML tags, trim.
---@param value any
---@param maxLength? number
---@param stripTags? boolean
---@return string
function M.SanitizeText(value, maxLength, stripTags)
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

---Strip control chars, HTML tags, trim, return nil if empty.
---@param value any
---@param maxLength? number
---@return string|nil
function M.SafeText(value, maxLength)
    if type(value) ~= 'string' then return nil end
    local text = value:gsub('[%z\1-\31\127]', '')
    text = text:gsub('<.->', '')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    if text == '' then return nil end
    return text:sub(1, maxLength or 80)
end

---Sanitize phone number: keep digits, +, -, (, ), spaces.
---@param value any
---@return string|nil
function M.SafePhone(value)
    if type(value) ~= 'string' then return nil end
    local number = value:gsub('[^%d%+%-%(%s%)]', '')
    number = number:gsub('^%s+', ''):gsub('%s+$', '')
    if number == '' then return nil end
    return number:sub(1, 20)
end

---Clamp a numeric value between min and max.
---@param value any
---@param min? number
---@param max? number
---@return number|nil
function M.SafeNumber(value, min, max)
    local num = tonumber(value)
    if not num then return nil end
    if min and num < min then num = min end
    if max and num > max then num = max end
    return num
end

---Validate and sanitize a media URL (must be http/https).
---@param value any
---@param allowedExt? string[]
---@param maxLen? number
---@return string|nil
function M.SanitizeMediaUrl(value, allowedExt, maxLen)
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

---Check the named rate-limit bucket via security exports.
---@param source integer
---@param key string
---@param windowMs integer
---@param maxHits integer
---@return boolean blocked
function M.HitRateLimit(source, key, windowMs, maxHits)
    local ok, blocked = pcall(function()
        return exports[RESOURCE_NAME]:HitRateLimit(source, key, windowMs, maxHits)
    end)

    if not ok then return false end
    return blocked == true
end

---Read rate-limit window from Config.Security.RateLimits with fallback.
---@param key string
---@param fallback number
---@return integer
function M.GetRateLimitWindow(key, fallback)
    local rateLimits = Config and Config.Security and Config.Security.RateLimits or nil
    local value = tonumber(rateLimits and rateLimits[key]) or tonumber(fallback)
    if not value or value < 100 then
        value = tonumber(fallback) or 1000
    end
    return math.floor(value)
end

---Check if identifier matches the phone owner for the given source (export access guard).
---@param identifier string
---@param requestSource integer
---@param getOwnerFn function GetPhoneOwnerIdentifier
---@param getIdFn function Bridge.GetIdentifier
---@return boolean
function M.CanAccessIdentifierExport(identifier, requestSource, getOwnerFn, getIdFn)
    local src = tonumber(requestSource)
    if not src or src <= 0 or not identifier then
        return false
    end

    local ownerIdentifier = getOwnerFn and getOwnerFn(src, true) or getIdFn(src)
    return ownerIdentifier ~= nil and ownerIdentifier == identifier
end

---Check whether either side of a social interaction is blocked (via security exports).
---@param sourceIdentifier string
---@param targetIdentifier string
---@param sourcePhone string
---@param targetPhone string
---@return boolean
function M.IsBlockedEither(sourceIdentifier, targetIdentifier, sourcePhone, targetPhone)
    local ok, blocked = pcall(function()
        return exports[RESOURCE_NAME]:IsBlockedEither(sourceIdentifier, targetIdentifier, sourcePhone, targetPhone)
    end)
    if not ok then return false end
    return blocked == true
end

return M
