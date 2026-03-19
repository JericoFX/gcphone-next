local RateLimitBuckets = {}
local IdentifierBuckets = {}
local SourceToIdentifier = {}

local function SafeString(value, maxLen)
    if type(value) ~= 'string' then return nil end
    local text = value:gsub('[%z\1-\31\127]', ''):gsub('^%s+', ''):gsub('%s+$', '')
    if text == '' then return nil end
    if maxLen and #text > maxLen then
        text = text:sub(1, maxLen)
    end
    return text
end

local function EnsureSecurityTables()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `phone_user_blocks` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `identifier` VARCHAR(64) NOT NULL,
            `target_identifier` VARCHAR(64) DEFAULT NULL,
            `target_phone` VARCHAR(20) NOT NULL,
            `reason` VARCHAR(120) DEFAULT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY `uniq_block_pair` (`identifier`, `target_phone`),
            KEY `idx_blocks_identifier` (`identifier`),
            KEY `idx_blocks_target_phone` (`target_phone`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])

    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `phone_user_reports` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `identifier` VARCHAR(64) NOT NULL,
            `target_identifier` VARCHAR(64) DEFAULT NULL,
            `target_phone` VARCHAR(20) DEFAULT NULL,
            `app_id` VARCHAR(24) NOT NULL,
            `evidence` VARCHAR(500) DEFAULT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY `idx_reports_identifier` (`identifier`),
            KEY `idx_reports_target_phone` (`target_phone`),
            KEY `idx_reports_app` (`app_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ]])
end

CreateThread(function()
    EnsureSecurityTables()
end)

local function CheckBucket(buckets, owner, key, windowMs, maxHits, now)
    buckets[owner] = buckets[owner] or {}
    local bucket = buckets[owner][key]
    if not bucket then
        buckets[owner][key] = { start = now, count = 1 }
        return false
    end

    if (now - bucket.start) > windowMs then
        bucket.start = now
        bucket.count = 1
        return false
    end

    bucket.count = bucket.count + 1
    return bucket.count > maxHits
end

local function HitRateLimit(source, key, windowMs, maxHits)
    source = tonumber(source)
    if not source or source <= 0 then return false end
    key = SafeString(tostring(key or ''), 40) or 'default'
    windowMs = tonumber(windowMs) or 1000
    maxHits = tonumber(maxHits) or 1
    if windowMs < 100 then windowMs = 100 end
    if maxHits < 1 then maxHits = 1 end

    local now = GetGameTimer()

    -- Resolve identifier for this source (cached per session)
    local identifier = SourceToIdentifier[source]
    if not identifier and type(GetIdentifier) == 'function' then
        identifier = GetIdentifier(source)
        if identifier then
            SourceToIdentifier[source] = identifier
        end
    end

    -- Check source-level bucket (fast path)
    local blockedBySource = CheckBucket(RateLimitBuckets, source, key, windowMs, maxHits, now)

    -- Also check identifier-level bucket (survives reconnects)
    if identifier then
        local blockedByIdentifier = CheckBucket(IdentifierBuckets, identifier, key, windowMs, maxHits, now)
        return blockedBySource or blockedByIdentifier
    end

    return blockedBySource
end

local function IsBlockedByIdentifier(identifier, targetPhone)
    if not identifier or not targetPhone then return false end
    local row = MySQL.single.await(
        'SELECT id FROM phone_user_blocks WHERE identifier = ? AND target_phone = ? LIMIT 1',
        { identifier, targetPhone }
    )
    return row ~= nil
end

local function IsBlockedEither(sourceIdentifier, targetIdentifier, sourcePhone, targetPhone)
    if sourceIdentifier and targetPhone and IsBlockedByIdentifier(sourceIdentifier, targetPhone) then
        return true
    end
    if targetIdentifier and sourcePhone and IsBlockedByIdentifier(targetIdentifier, sourcePhone) then
        return true
    end
    return false
end

local function RecordReport(identifier, targetIdentifier, targetPhone, appId, evidence)
    local app = SafeString(appId, 24) or 'unknown'
    local note = SafeString(evidence, 500)
    local phone = SafeString(targetPhone, 20)
    local target = SafeString(targetIdentifier, 64)

    MySQL.insert.await(
        'INSERT INTO phone_user_reports (identifier, target_identifier, target_phone, app_id, evidence) VALUES (?, ?, ?, ?, ?)',
        { identifier, target, phone, app, note }
    )
end

lib.callback.register('gcphone:security:getBlockedNumbers', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    return MySQL.query.await(
        'SELECT id, target_phone, reason, created_at FROM phone_user_blocks WHERE identifier = ? ORDER BY created_at DESC LIMIT 200',
        { identifier }
    ) or {}
end)

lib.callback.register('gcphone:security:blockNumber', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local targetPhone = SafeString(data.targetPhone, 20)
    local reason = SafeString(data.reason, 120)
    if not targetPhone then return { success = false, error = 'INVALID_PHONE' } end

    local targetIdentifier = GetIdentifierByPhone(targetPhone)
    MySQL.query.await(
        'INSERT INTO phone_user_blocks (identifier, target_identifier, target_phone, reason) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE reason = VALUES(reason)',
        { identifier, targetIdentifier, targetPhone, reason }
    )

    return { success = true }
end)

lib.callback.register('gcphone:security:unblockNumber', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local targetPhone = SafeString(data.targetPhone, 20)
    if not targetPhone then return { success = false, error = 'INVALID_PHONE' } end

    MySQL.update.await(
        'DELETE FROM phone_user_blocks WHERE identifier = ? AND target_phone = ?',
        { identifier, targetPhone }
    )

    return { success = true }
end)

lib.callback.register('gcphone:security:reportUser', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local targetPhone = SafeString(data.targetPhone, 20)
    local appId = SafeString(data.appId, 24)
    local evidence = SafeString(data.evidence, 500)
    if not targetPhone or not appId then return { success = false, error = 'INVALID_REPORT' } end

    local reportMs = (Config.Security and Config.Security.ReportCooldownMs) or 2500
    if HitRateLimit(source, 'report', reportMs, 1) then
        return { success = false, error = 'RATE_LIMITED' }
    end

    local targetIdentifier = GetIdentifierByPhone(targetPhone)
    RecordReport(identifier, targetIdentifier, targetPhone, appId, evidence)
    return { success = true }
end)

---Hit a named rate-limit bucket for a player source.
---@param source integer
---@param key string
---@param windowMs integer
---@param maxHits? integer
---@return boolean
exports('HitRateLimit', HitRateLimit)

---Check whether an identifier is blocked from using social features.
---@param identifier string
---@return boolean
exports('IsBlockedByIdentifier', IsBlockedByIdentifier)

---Check whether either side of a social interaction is blocked.
---@param identifierA string
---@param identifierB string
---@return boolean
exports('IsBlockedEither', IsBlockedEither)

---Record a moderation report between players/identifiers.
---@param reporterIdentifier string
---@param targetIdentifier string|nil
---@param targetPhone string|nil
---@param appId string|nil
---@param evidence string|table|nil
---@return nil
exports('RecordReport', RecordReport)

AddEventHandler('playerDropped', function()
    RateLimitBuckets[source] = nil
    SourceToIdentifier[source] = nil
    -- IdentifierBuckets intentionally NOT cleared — survives reconnects
end)

-- Periodic cleanup of stale identifier buckets (every 5 minutes)
CreateThread(function()
    while true do
        Wait(300000)
        local now = GetGameTimer()
        for id, keys in pairs(IdentifierBuckets) do
            local hasActive = false
            for key, bucket in pairs(keys) do
                if (now - bucket.start) > 60000 then
                    keys[key] = nil
                else
                    hasActive = true
                end
            end
            if not hasActive then
                IdentifierBuckets[id] = nil
            end
        end
    end
end)
