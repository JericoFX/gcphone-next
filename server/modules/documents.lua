-- Creado/Modificado por JericoFX
-- Documents - Backend con soporte NFC

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
    local validTypes = {
        id = 'ID',
        license = 'Licencia',
        permit = 'Permiso',
        passport = 'Pasaporte',
        insurance = 'Seguro',
        registration = 'Registro',
        work_permit = 'Permiso Trabajo'
    }
    if validTypes[docType] then
        return docType
    end
    return nil
end

local function BuildDocCode(identifier, docType)
    local seed = tostring(identifier or '') .. ':' .. tostring(docType or '') .. ':' .. tostring(os.time()) .. ':' .. tostring(math.random(1000, 9999))
    return string.upper(string.sub(tostring(GetHashKey(seed)), -8))
end

-- Get my documents
lib.callback.register('gcphone:documents:getList', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    return MySQL.query.await(
        'SELECT id, doc_type, title, holder_name, holder_number, expires_at, verification_code, created_at, nfc_enabled FROM phone_documents WHERE identifier = ? ORDER BY id DESC',
        { identifier }
    ) or {}
end)

-- Create document
lib.callback.register('gcphone:documents:create', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end

    local docType = SafeType(data.docType)
    local title = SafeString(data.title, 64) or 'Documento'
    local holderName = SafeString(data.holderName, 64) or (GetName(source) or 'Ciudadano')
    local holderNumber = SafeString(data.holderNumber, 20)
    local expiresAt = SafeString(data.expiresAt, 24)
    local nfcEnabled = data.nfcEnabled and 1 or 0

    if not docType then return { success = false, error = 'INVALID_TYPE' } end

    local code = BuildDocCode(identifier, docType)
    local id = MySQL.insert.await(
        'INSERT INTO phone_documents (identifier, doc_type, title, holder_name, holder_number, expires_at, verification_code, nfc_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        { identifier, docType, title, holderName, holderNumber, expiresAt, code, nfcEnabled }
    )

    local doc = MySQL.single.await(
        'SELECT id, doc_type, title, holder_name, holder_number, expires_at, verification_code, created_at, nfc_enabled FROM phone_documents WHERE id = ?',
        { id }
    )

    return {
        success = true,
        document = doc,
    }
end)

-- Delete document
lib.callback.register('gcphone:documents:delete', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    local id = tonumber(type(data) == 'table' and data.documentId or nil)
    if not id then return { success = false, error = 'INVALID_DOCUMENT' } end

    MySQL.update.await('DELETE FROM phone_documents WHERE id = ? AND identifier = ?', { id, identifier })
    return { success = true }
end)

-- Enable/Disable NFC for document
lib.callback.register('gcphone:documents:toggleNFC', function(source, data)
    local identifier = GetIdentifier(source)
    if not identifier then return { success = false, error = 'INVALID_SOURCE' } end
    
    local id = tonumber(type(data) == 'table' and data.documentId or nil)
    local enabled = data.enabled and 1 or 0
    
    if not id then return { success = false, error = 'INVALID_DOCUMENT' } end

    MySQL.update.await(
        'UPDATE phone_documents SET nfc_enabled = ? WHERE id = ? AND identifier = ?',
        { enabled, id, identifier }
    )
    
    return { success = true }
end)

-- Scan NFC (read document via NFC)
lib.callback.register('gcphone:documents:scanNFC', function(source, data)
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end
    
    local verificationCode = SafeString(data.code)
    if not verificationCode then return { success = false, error = 'INVALID_CODE' } end

    -- Find document by verification code
    local doc = MySQL.single.await(
        'SELECT d.*, n.phone_number FROM phone_documents d ' ..
        'LEFT JOIN phone_numbers n ON d.identifier = n.identifier ' ..
        'WHERE d.verification_code = ? AND d.nfc_enabled = 1',
        { verificationCode }
    )

    if not doc then
        return { success = false, error = 'DOCUMENT_NOT_FOUND' }
    end

    -- Check if expired
    if doc.expires_at then
        local expires = os.time({year=tonumber(doc.expires_at:sub(1,4)), month=tonumber(doc.expires_at:sub(6,7)), day=tonumber(doc.expires_at:sub(9,10))})
        if os.time() > expires then
            return { success = false, error = 'DOCUMENT_EXPIRED' }
        end
    end

    -- Record scan
    local scannerIdentifier = GetIdentifier(source)
    MySQL.insert.await(
        'INSERT INTO phone_documents_nfc_scans (document_id, scanned_by, scan_type) VALUES (?, ?, ?)',
        { doc.id, scannerIdentifier, 'nfc' }
    )

    -- Return document info (without sensitive data)
    return {
        success = true,
        document = {
            doc_type = doc.doc_type,
            title = doc.title,
            holder_name = doc.holder_name,
            holder_number = doc.holder_number,
            expires_at = doc.expires_at,
            verification_code = doc.verification_code,
            scanned_at = os.date('%Y-%m-%d %H:%M:%S')
        }
    }
end)

-- Verify document by code (manual verification)
lib.callback.register('gcphone:documents:verify', function(source, data)
    if type(data) ~= 'table' then return { success = false, error = 'INVALID_DATA' } end
    
    local code = SafeString(data.code)
    if not code then return { success = false, error = 'INVALID_CODE' } end

    local doc = MySQL.single.await(
        'SELECT d.*, n.phone_number FROM phone_documents d ' ..
        'LEFT JOIN phone_numbers n ON d.identifier = n.identifier ' ..
        'WHERE d.verification_code = ?',
        { code }
    )

    if not doc then
        return { success = false, error = 'DOCUMENT_NOT_FOUND' }
    end

    -- Check expiration
    local isExpired = false
    if doc.expires_at then
        local expires = os.time({year=tonumber(doc.expires_at:sub(1,4)), month=tonumber(doc.expires_at:sub(6,7)), day=tonumber(doc.expires_at:sub(9,10))})
        isExpired = os.time() > expires
    end

    -- Record verification
    local verifierIdentifier = GetIdentifier(source)
    MySQL.insert.await(
        'INSERT INTO phone_documents_nfc_scans (document_id, scanned_by, scan_type) VALUES (?, ?, ?)',
        { doc.id, verifierIdentifier, 'manual' }
    )

    return {
        success = true,
        valid = not isExpired,
        expired = isExpired,
        document = {
            doc_type = doc.doc_type,
            title = doc.title,
            holder_name = doc.holder_name,
            holder_number = doc.holder_number,
            expires_at = doc.expires_at,
            verification_code = doc.verification_code
        }
    }
end)

-- Get scan history for my documents
lib.callback.register('gcphone:documents:getScanHistory', function(source)
    local identifier = GetIdentifier(source)
    if not identifier then return {} end

    return MySQL.query.await([[
        SELECT s.*, d.title, d.doc_type
        FROM phone_documents_nfc_scans s
        JOIN phone_documents d ON s.document_id = d.id
        WHERE d.identifier = ?
        ORDER BY s.scanned_at DESC
        LIMIT 50
    ]], { identifier }) or {}
end)

-- Get document types
lib.callback.register('gcphone:documents:getTypes', function(source)
    return {
        { id = 'id', name = 'DNI / ID', icon: '🆔', color: '#007aff' },
        { id = 'license', name: 'Licencia de Conducir', icon: '🚗', color: '#34c759' },
        { id = 'passport', name: 'Pasaporte', icon: '🛂', color: '#ff9500' },
        { id = 'permit', name: 'Permiso Especial', icon: '📄', color: '#af52de' },
        { id = 'work_permit', name: 'Permiso de Trabajo', icon: '💼', color: '#5856d6' },
        { id = 'insurance', name: 'Seguro', icon: '🛡️', color: '#ff3b30' },
        { id = 'registration', name: 'Registro Civil', icon: '📋', color: '#5ac8fa' }
    }
end)
