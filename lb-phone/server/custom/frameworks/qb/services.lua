if Config.Framework ~= "qb" then
    return
end

while not QB do
    Wait(500)
    debugprint("Services: Waiting for QB to load")
end

local playerJobs = {}
local jobCounts = {}
local jobDutyCounts = {}

---@param source number
---@return string
function GetJob(source)
    local qPlayer = QB.Functions.GetPlayer(tonumber(source))

    if not qPlayer then
        debugprint("GetJob: Failed to get player for source:", source)
        return "unemployed"
    end

    return qPlayer.PlayerData.job.name
end

---@param job string
---@return { firstname: string, lastname: string, grade: string, number: string }[] employees
function GetAllEmployees(job)
    local numberTable = Config.Item.Unique and "phone_last_phone" or "phone_phones"
    local employees = MySQL.query.await(([[
        SELECT
            JSON_UNQUOTE(JSON_EXTRACT(u.charinfo, '$.firstname')) AS firstname,
            JSON_UNQUOTE(JSON_EXTRACT(u.charinfo, '$.lastname')) AS lastname,
            u.citizenid,
            JSON_UNQUOTE(JSON_EXTRACT(u.job, '$.grade.level')) AS grade,
            JSON_UNQUOTE(JSON_EXTRACT(u.job, '$.grade.name')) AS gradeLabel,
            p.phone_number AS `number`
        FROM players u
        LEFT JOIN %s p ON u.citizenid = p.id COLLATE UTF8MB4_GENERAL_CI
        WHERE JSON_UNQUOTE(JSON_EXTRACT(u.job, '$.name')) = ?
    ]]):format(numberTable), { job })

    for i = 1, #employees do
        local employee = employees[i]
        local player = QB.Functions.GetPlayerByCitizenId(employee.citizenid)

        employee.citizenid = nil

        if player and player.PlayerData?.job then
            employee.duty = player.PlayerData.job.onduty
        end
    end

    return employees
end

---Get an array of player sources with a specific job
---@param job string
---@return table # Player sources
function GetEmployees(job)
    local employees = {}
    local players = QB.Functions.GetQBPlayers()

    for _, v in pairs(players) do
        if v?.PlayerData.job.name == job and v.PlayerData.job.onduty then
            employees[#employees + 1] = v.PlayerData.source
        end
    end

    return employees
end

function RefreshCompanies()
    if Config.QBOldJobMethod then
        debugprint("using old method to refresh companies")

        local openJobs = {}
        local players = QB.Functions.GetQBPlayers()

        for _, v in pairs(players) do
            if not v?.PlayerData.job.onduty then
                goto continue
            end

            local job = v.PlayerData.job.name

            if not openJobs[job] then
                openJobs[job] = true
            end

            ::continue::
        end

        for i = 1, #Config.Companies.Services do
            local jobData = Config.Companies.Services[i]

            jobData.open = openJobs[jobData.job] or false
        end

        return
    end

    for i = 1, #Config.Companies.Services do
        local jobData = Config.Companies.Services[i]

        jobData.open = (jobDutyCounts[jobData.job] or 0) > 0
    end
end

CreateThread(function()
    for _, player in pairs(QB.Functions.GetQBPlayers()) do
        local playerData = player.PlayerData
        local job = playerData.job
        local jobName = job.name
        local onDuty = job.onduty

        playerJobs[playerData.source] = {
            name = jobName,
            onduty = onDuty
        }

        jobCounts[jobName] = (jobCounts[jobName] or 0) + 1
        jobDutyCounts[jobName] = (jobDutyCounts[jobName] or 0) + (onDuty and 1 or 0)
    end

    debugprint("qb jobs: initial data", playerJobs, jobCounts, jobDutyCounts)
end)

AddEventHandler('QBCore:Server:PlayerLoaded', function(Player)
    local job = Player.PlayerData.job
    local src = Player.PlayerData.source
    local jobName = job?.name
    local onDuty = job?.onduty

    if not jobName then
        return
    end

    playerJobs[src] = {
        name = jobName,
        onduty = onDuty
    }

    jobCounts[jobName] = (jobCounts[jobName] or 0) + 1
    jobDutyCounts[jobName] = (jobDutyCounts[jobName] or 0) + (onDuty and 1 or 0)

    debugprint("qb jobs: player loaded update (src, job, duty)", src, job.name, job.onduty)
end)

AddEventHandler("QBCore:Server:OnJobUpdate", function(src, job)
    local shouldRefresh = false
    local lastJob = playerJobs[src]
    local lastName = lastJob and lastJob.name
    local lastDuty = lastJob and lastJob.onduty
    local jobName = job.name
    local onDuty = job.onduty

    Wait(0)
    debugprint("qb jobs: job update (src, job, duty)", src, job.name, job.onduty)

    if lastJob and lastName == jobName then
        if lastJob.onduty == onDuty then
            return
        end

        jobDutyCounts[jobName] = (jobDutyCounts[jobName] or 0) + (onDuty and 1 or -1)
    else
        if lastJob then
            jobCounts[lastName] = (jobCounts[lastName] or 0) - 1
            jobDutyCounts[lastName] = (jobDutyCounts[lastName] or 0) - (lastDuty and 1 or 0)

            local oldCount = jobDutyCounts[lastName]

            if oldCount == 0 or oldCount == 1 then
                TriggerClientEvent("phone:services:updateOpen", -1, lastName, oldCount == 1)
                shouldRefresh = true
            end
        end

        jobCounts[jobName] = (jobCounts[jobName] or 0) + 1
        jobDutyCounts[jobName] = (jobDutyCounts[jobName] or 0) + (onDuty and 1 or 0)
    end

    playerJobs[src] = {
        name = jobName,
        onduty = onDuty
    }

    local newCount = jobDutyCounts[jobName]

    if newCount == 0 or newCount == 1 then
        TriggerClientEvent("phone:services:updateOpen", -1, jobName, newCount == 1)
        shouldRefresh = true
    end

    if shouldRefresh then
        RefreshCompanies()
    end

    debugprint(playerJobs, jobCounts, jobDutyCounts)
end)

local function UnloadJob(src)
    local lastJob = playerJobs[src]

    if not lastJob then
        return
    end

    jobCounts[lastJob.name] = (jobCounts[lastJob.name] or 0) - 1
    jobDutyCounts[lastJob.name] = (jobDutyCounts[lastJob.name] or 0) - (lastJob.onduty and 1 or 0)

    playerJobs[src] = nil

    debugprint(playerJobs, jobCounts, jobDutyCounts)
end

AddEventHandler("QBCore:Server:OnPlayerUnload", function(src)
    Wait(0)
    debugprint("qb jobs: player unload", src)

    UnloadJob(src)
end)

AddEventHandler("playerDropped", function()
    local src = source

    debugprint("qb jobs: player dropped", src)
    UnloadJob(src)
end)

RegisterLegacyCallback("services:getPlayerData", function(_, cb, player)
    local first, last = GetCharacterName(player)

    cb({
        name = first .. " " .. last,
        id = GetIdentifier(player),
    })
end)

local function GetSocietyMoney(job)
    local success, res = pcall(function()
        return exports["qb-management"]:GetAccount(job)
    end)

    if success then
        return res
    end

    return exports["qb-banking"]:GetAccountBalance(job)
end

RegisterLegacyCallback("services:getAccount", function(source, cb)
    local job = GetJob(source)

    cb(GetSocietyMoney(job))
end)

RegisterLegacyCallback("services:addMoney", function(source, cb, amount)
    local job = GetJob(source)

    if amount < 0 or GetBalance(source) < amount then
        return cb(false)
    end

    local success, _ = pcall(function()
        return exports["qb-management"]:AddMoney(job, amount)
    end)

    if success or exports["qb-banking"]:AddMoney(job, amount) then
        RemoveMoney(source, amount)
    end

    cb(GetSocietyMoney(job))
end)

RegisterLegacyCallback("services:removeMoney", function(source, cb, amount)
    local job = GetJob(source)

    if amount < 0 or GetSocietyMoney(job) < amount then
        return
    end

    local success, res = pcall(function()
        return exports["qb-management"]:RemoveMoney(job, amount)
    end)

    if not success then
        res = exports["qb-banking"]:RemoveMoney(job, amount)
    end

    if res then
        AddMoney(source, amount)
    end

    cb(GetSocietyMoney(job))
end)
