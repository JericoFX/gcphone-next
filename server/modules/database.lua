-- gcphone-next Database Schema Checker
-- Verifies that required tables exist on resource start.
-- The actual schema is defined in sql/schema.sql and must be
-- imported manually before first use.

local REQUIRED_TABLES = {
    'phone_numbers',
    'phone_contacts',
    'phone_messages',
    'phone_calls',
    'phone_gallery',
    'phone_layouts',
    'phone_chat_groups',
    'phone_chat_group_members',
    'phone_chat_group_messages',
    'phone_cleanup_rules',
}

local function CheckSchema()
    if GetResourceState('oxmysql') ~= 'started' then
        print('^1[gcphone-next] ERROR: oxmysql not started, cannot check database^7')
        return false
    end

    local missing = {}
    for _, tableName in ipairs(REQUIRED_TABLES) do
        local result = MySQL.query.await(
            "SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
            { tableName }
        )
        if not result or not result[1] or tonumber(result[1].cnt) == 0 then
            missing[#missing + 1] = tableName
        end
    end

    if #missing > 0 then
        print('^1[gcphone-next] ERROR: Missing database tables: ' .. table.concat(missing, ', ') .. '^7')
        print('^1[gcphone-next] Please import sql/schema.sql into your database before starting this resource.^7')
        return false
    end

    print('^2[gcphone-next] Database schema OK^7')
    return true
end

MySQL.ready(function()
    CheckSchema()
end)

exports('CheckSchema', CheckSchema)

return {}
