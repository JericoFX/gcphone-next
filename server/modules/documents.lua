-- Creado/Modificado por JericoFX

local function SafeString(value, maxLen)
    if type(value) ~= 'string' then return nil end
    local trimmed = value:gsub('%s+', ' '):gsub('^%s+', ''):gsub('%s+$', '')
    if trimmed == '' then return nil end
    if maxLen and #trimmed > maxLen then
        trimmed = trimmed:sub(1, maxLen)
    end
    return trimmed
end

local function SafeType(value)
    local docType = SafeString(value, 24)
    if docType == 'id' or docType == 'license' or docType == 'permit' then
        return docType
    end
    return nil
end

local function BuildDocCode(identifier, docType)
    local seed = tostring(identifier or '') .. ':' .. tostring(docType or '') .. ':' .. tostring(os.time()) .. ':' .. tostring(math.random(1000, 9999))
    return string.upper(string.sub(tostring(GetHashKey(seed)), -8))
end

lib.callback.register('gcphone:documents:getList', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    return MySQL.query.await(
        'SELECT id, doc_type, title, holder_name, holder_number, expires_at, verification_code, created_at FROM phone_documents WHERE identifier = ? ORDER BY id DESC',
        { identifier }
    ) or {}
end)

lib.callback.register('gcphone:documents:create', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local docType = SafeType(data.docType)
    local title = SafeString(data.title, 64) or 'Documento'
    local holderName = SafeString(data.holderName, 64) or (GetName(source) or 'Ciudadano')
    local holderNumber = SafeString(data.holderNumber, 20)
    local expiresAt = SafeString(data.expiresAt, 24)

    if not docType then return { success = false, error = 'INVALID_TYPE' } end

    local code = BuildDocCode(identifier, docType)
    local id = MySQL.insert.await(
        'INSERT INTO phone_documents (identifier, doc_type, title, holder_name, holder_number, expires_at, verification_code) VALUES (?, ?, ?, ?, ?, ?, ?)',
        { identifier, docType, title, holderName, holderNumber, expiresAt, code }
    )

    local doc = MySQL.single.await(
        'SELECT id, doc_type, title, holder_name, holder_number, expires_at, verification_code, created_at FROM phone_documents WHERE id = ?',
        { id }
    )

    return {
        success = true,
        document = doc,
    }
end)

lib.callback.register('gcphone:documents:delete', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    local id = tonumber(type(data) == 'table' and data.documentId or nil)
    if not id then return { success = false, error = 'INVALID_DOCUMENT' } end

    MySQL.update.await('DELETE FROM phone_documents WHERE id = ? AND identifier = ?', { id, identifier })
    return { success = true }
end)
