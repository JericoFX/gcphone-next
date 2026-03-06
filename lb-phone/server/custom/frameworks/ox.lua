if Config.Framework ~= "ox" then
    return
end

-- We have to use our own wrapper for ox_core as it uses ox_lib, breaking the phone.

local oxCore = exports.ox_core

local function GetPlayerData(source, ...)
    return oxCore:CallPlayer(source, "get", ...)
end

local function GetSourceFromCharacterId(charId)
    local players = GetPlayers()

    for i = 1, #players do
        local player = tonumber(players[i])

        if player and GetIdentifier(player) == charId then
            return player
        end
    end
end

---@param source number
---@return number | nil
local function GetAccountId(source)
    local identifier = GetIdentifier(source)

    if not identifier then
        return
    end

    return oxCore:GetCharacterAccount(identifier)?.accountId
end

---@param source number
---@return string | nil
function GetIdentifier(source)
    return oxCore:GetPlayer(source)?.charId
end

---@param source number
---@param itemName string
function HasItem(source, itemName)
    return (exports.ox_inventory:Search(source, "count", itemName) or 0) > 0
end

---@param source number
---@return string firstname
---@return string lastname
function GetCharacterName(source)
    return GetPlayerData(source, "firstName"), GetPlayerData(source, "lastName")
end

---@param source any
---@return integer
function GetBalance(source)
    local accountId = GetAccountId(source)

    return accountId and oxCore:CallAccount(accountId, "get", "balance") or 0
end

---@param source any
---@param amount integer
---@return boolean success
function AddMoney(source, amount)
    local accountId = GetAccountId(source)

    if not accountId then
        return false
    end

    return oxCore:CallAccount(accountId, "addBalance", {
        amount = amount,
        message = "Phone"
    })?.success == true
end

---@param source any
---@param amount integer
---@return boolean success
function RemoveMoney(source, amount)
    local accountId = GetAccountId(source)

    if not accountId then
        return false
    end

    return oxCore:CallAccount(accountId, "removeBalance", {
        amount = amount,
        message = "Phone"
    })?.success == true
end

---@param source number
function IsAdmin(source)
    ---@diagnostic disable-next-line: param-type-mismatch
    return IsPlayerAceAllowed(source, "command.lbphone_admin") == 1
end

-- TODO: Player vehicles do not exist in ox_core?

---@param source number
---@return VehicleData[] vehicles An array of vehicles that the player owns
function GetPlayerVehicles(source)
    return {}
end

---@param source number
---@param plate string
function GetVehicle(source, plate)
    return false
end

-- TODO: Jobs do not exist in ox_core?

function GetJob(source)
    local jobData = oxCore:CallPlayer(source, "getGroupByType", "job")

    if not jobData then
        return ""
    end

    return jobData[1]
end

BaseCallback("services:getManagementEmployees", function(source, phoneNumber, ...)
    local job = GetJob(source)
    local grades = GlobalState["group." .. job]?.grades or {}

    if not grades then
        return {}
    end

    local employees = MySQL.query.await([[
        SELECT
            c.userId,
            c.charId AS `id`,
            c.fullName AS `name`,
            cg.grade
        FROM character_groups cg
        LEFT JOIN characters c ON cg.charId = c.charId
        WHERE cg.name = ?
    ]], { job })

    for i = 1, #employees do
        local employee = employees[i]

        employee.gradeLabel = grades[employee.grade] or "Unknown"
        employee.online = oxCore:GetPlayerFromUserId(employee.userId)?.charId == employee.id
    end

    return employees
end)

BaseCallback("services:getBalance", function(source, phoneNumber)
    local jobData = oxCore:CallPlayer(source, "getGroupByType", "job")

    if not jobData then
        return 0
    end

    local job, _ = table.unpack(jobData)
    local accountId = oxCore:GetGroupAccount(job)?.accountId

    if not accountId then
        return 0
    end

    return oxCore:CallAccount(accountId, "get", "balance") or 0
end, 0)

BaseCallback("services:depositMoney", function(source, phoneNumber, amount)
    local jobData = oxCore:CallPlayer(source, "getGroupByType", "job")

    if not jobData then
        return 0
    end

    local job, _ = table.unpack(jobData)
    local accountId = oxCore:GetGroupAccount(job)?.accountId

    if not accountId then
        return 0
    end

    if not RemoveMoney(source, amount) then
        return 0
    end

    if not oxCore:CallAccount(accountId, "addBalance", {
            amount = amount,
            message = "Phone"
        })?.success then
        debugprint("Failed to deposit money")
    end

    return oxCore:CallAccount(accountId, "get", "balance") or 0
end)

BaseCallback("services:withdrawMoney", function(source, phoneNumber, amount)
    local jobData = oxCore:CallPlayer(source, "getGroupByType", "job")

    if not jobData then
        return 0
    end

    local job, _ = table.unpack(jobData)
    local accountId = oxCore:GetGroupAccount(job)?.accountId

    if not accountId then
        return 0
    end

    if not RemoveMoney(source, amount) then
        return 0
    end

    if not oxCore:CallAccount(accountId, "removeBalance", {
            amount = amount,
            message = "Phone"
        })?.success then
        debugprint("Failed to deposit money")
    end

    return oxCore:CallAccount(accountId, "get", "balance") or 0
end)

BaseCallback("services:hireEmployee", function(source, phoneNumber, targetSource)
    local targetIdentifier = GetIdentifier(targetSource)
    local jobData = oxCore:CallPlayer(source, "getGroupByType", "job")

    if not targetIdentifier or not jobData then
        return false
    end

    local job, grade = table.unpack(jobData)
    local amountGrades = #(GlobalState["group." .. job]?.grades or {})

    if grade ~= amountGrades or GetJob(targetSource) == job then
        return false
    end

    oxCore:CallPlayer(targetSource, "setGroup", job, 1)

    return {
        name = GetPlayerData(targetSource, "firstName") .. " " .. GetPlayerData(targetSource, "lastName"),
        id = targetIdentifier
    }
end)

BaseCallback("services:fireEmployee", function(source, phoneNumber, identifier)
    local jobData = oxCore:CallPlayer(source, "getGroupByType", "job")

    if not jobData then
        return false
    end

    local job, grade = table.unpack(jobData)
    local amountGrades = #(GlobalState["group." .. job]?.grades or {})

    if grade ~= amountGrades then
        return false
    end

    local targetSource = GetSourceFromCharacterId(identifier)

    if targetSource then
        oxCore:CallPlayer(targetSource, "setGroup", job, 0)
    else
        MySQL.update.await("DELETE FROM character_groups WHERE name = ? AND charId = ?", { job, identifier })
    end

    return true
end)

BaseCallback("services:setGrade", function(source, phoneNumber, identifier, newGrade)
    local jobData = oxCore:CallPlayer(source, "getGroupByType", "job")

    if not jobData then
        return false
    end

    local job, grade = table.unpack(jobData)
    local amountGrades = #(GlobalState["group." .. job]?.grades or {})

    if grade ~= amountGrades then
        return false
    end

    local targetSource = GetSourceFromCharacterId(identifier)

    if targetSource then
        oxCore:CallPlayer(targetSource, "setGroup", job, newGrade)
    else
        MySQL.update.await("UPDATE character_groups SET grade = ? WHERE name = ? AND charId = ?",
            { newGrade, job, identifier })
    end

    return true
end)

---@param job string
---@return number[] employees
function GetEmployees(job)
    local employees = {}
    local players = GetPlayers()

    for i = 1, #players do
        local player = players[i]

        if GetJob(player) == job then
            employees[#employees + 1] = tonumber(player)
        end
    end

    return employees
end

---@param job string
---@return { firstname: string, lastname: string, grade: string, number: string }[] employees
function GetAllEmployees(job)
    local numberTable = Config.Item.Unique and "phone_last_phone" or "phone_phones"
    local grades = GlobalState["group." .. job]?.grades or {}

    if not grades then
        return {}
    end

    local employees = MySQL.query.await([[
        SELECT
            c.firstName as firstname,
            c.lastName as lastname,
            cg.grade,
            p.phone_number AS `number`
        FROM character_groups cg
        LEFT JOIN characters c ON cg.charId = c.charId
        LEFT JOIN ]] .. numberTable .. [[ p ON c.charId = p.id
        WHERE cg.name = ?
    ]], { job })

    for i = 1, #employees do
        employees[i].grade = grades[employees[i].grade] or "Unknown"
    end

    return employees
end

function RefreshCompanies()
    for i = 1, #Config.Companies.Services do
        local jobData = Config.Companies.Services[i]

        jobData.open = (GlobalState[jobData.job .. ":count"] or 0) > 0
    end
end

local jobGlobalStates = {}

for i = 1, #Config.Companies.Services do
    local jobData = Config.Companies.Services[i]

    jobData.open = (GlobalState[jobData.job .. ":count"] or 0) > 0
    jobGlobalStates[jobData.job .. ":count"] = jobData
end

---@diagnostic disable-next-line: param-type-mismatch
AddStateBagChangeHandler(nil, "global", function(bagName, key, value)
    if not jobGlobalStates[key] then
        return
    end

    local jobData = jobGlobalStates[key]
    local wasOpen = jobData.open
    local open = value > 0

    jobData.open = open

    if open ~= wasOpen then
        TriggerClientEvent("phone:services:updateOpen", -1, jobData.job, open)
    end
end)
