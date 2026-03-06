if Config.Framework ~= "esx" then
    return
end

while not ESX do
    Wait(500)
    debugprint("Services: Waiting for ESX to load")
end

---@type table<string, { total: number, onDuty: number }>
local jobCounts = {}

---@type table<number, { job: string, onDuty?: boolean }>
local playerJobs = {}

---@param source number
---@return string
function GetJob(source)
    return ESX.GetPlayerFromId(source)?.job?.name or "unemployed"
end

---@param job string
---@return { firstname: string, lastname: string, grade: string, number: string }[] employees
function GetAllEmployees(job)
    local numberTable = Config.Item.Unique and "phone_last_phone" or "phone_phones"
    local employees = MySQL.query.await(([[
        SELECT
            u.firstname,
            u.lastname,
            u.identifier,
            u.job_grade AS grade,
            j.label AS gradeLabel,
            p.phone_number AS `number`

        FROM users u

        LEFT JOIN %s p ON u.identifier = p.id COLLATE UTF8MB4_GENERAL_CI

        LEFT JOIN job_grades j ON u.job = j.job_name AND u.job_grade = j.grade

        WHERE u.job = ?
    ]]):format(numberTable), { job })

    for i = 1, #employees do
        local employee = employees[i]
        local player = ESX.GetPlayerFromIdentifier(employee.identifier)

        employee.identifier = nil

        if player then
            employee.duty = player.job.onDuty
        end
    end

    return employees
end

---Get an array of player sources with a specific job
---@param job string
---@return number[] # Player sources
function GetEmployees(job)
    local employees = {}

    for source, playerJob in pairs(playerJobs) do
        if playerJob.job == job and playerJob.onDuty then
            employees[#employees + 1] = source
        end
    end

    return employees
end

---@param duty boolean
RegisterNetEvent("phone:services:toggleDuty", function(duty)
    local xPlayer = ESX.GetPlayerFromId(source)
    local job = xPlayer?.job

    if job then
        xPlayer.setJob(job.name, job.grade, duty == true)
    end
end)

function RefreshCompanies()
    for i = 1, #Config.Companies.Services do
        local jobData = Config.Companies.Services[i]

        jobData.open = jobCounts[jobData.job] and jobCounts[jobData.job].onDuty > 0 or false
    end
end

-- On script/server start, update all job counts
Citizen.CreateThreadNow(function()
    local xPlayers = ESX.GetExtendedPlayers and ESX.GetExtendedPlayers() or ESX.GetPlayers()

    if ESX.GetExtendedPlayers then
        for _, xPlayer in pairs(xPlayers) do
            local job = xPlayer.job

            if job.onDuty == nil then
                job.onDuty = true
            end

            jobCounts[job.name] = jobCounts[job.name] or { total = 0, onDuty = 0 }
            jobCounts[job.name].total += 1
            jobCounts[job.name].onDuty += job.onDuty and 1 or 0

            playerJobs[xPlayer.source] = {
                job = job.name,
                onDuty = job.onDuty
            }
        end
    else
        for _, source in pairs(xPlayers) do
            local job = ESX.GetPlayerFromId(source).job.name

            if job.onDuty == nil then
                job.onDuty = true
            end

            jobCounts[job.name] = jobCounts[job.name] or { total = 0, onDuty = 0 }
            jobCounts[job.name].total += 1
            jobCounts[job.name].onDuty += job.onDuty and 1 or 0

            playerJobs[source] = {
                job = job.name,
                onDuty = job.onDuty
            }
        end
    end

    RefreshCompanies()
end)

---@alias ESXJobData { name: string, onDuty?: boolean, grade: number }

---@param source number
---@param job ESXJobData
---@param lastJob? ESXJobData
local function OnJobUpdate(source, job, lastJob)
    local shouldRefresh = false

    jobCounts[job.name] = jobCounts[job.name] or { total = 0, onDuty = 0 }

    if job.onDuty == nil then
        job.onDuty = true
    end

    if lastJob and lastJob.onDuty == nil then
        lastJob.onDuty = true
    end

    if lastJob and lastJob.name == job.name then
        if lastJob.onDuty == job.onDuty then
            return
        end

        jobCounts[job.name].onDuty += job.onDuty and 1 or -1

        local onDuty = jobCounts[job.name].onDuty

        if onDuty == 0 or onDuty == 1 then
            shouldRefresh = true

            TriggerClientEvent("phone:services:updateOpen", -1, job.name, onDuty == 1)
        end
    else
        local lastJobCount = lastJob and jobCounts[lastJob.name]

        if lastJob and lastJobCount then
            lastJobCount.total -= 1

            if lastJob.onDuty then
                lastJobCount.onDuty -= 1
            end

            if lastJobCount.onDuty == 0 then
                shouldRefresh = true

                TriggerClientEvent("phone:services:updateOpen", -1, lastJob.name, false)
            end
        end

        jobCounts[job.name] = jobCounts[job.name] or { total = 0, onDuty = 0 }
        jobCounts[job.name].total += 1
        jobCounts[job.name].onDuty += job.onDuty and 1 or 0

        local onDuty = jobCounts[job.name].onDuty

        if onDuty == 0 or onDuty == 1 then
            shouldRefresh = true

            TriggerClientEvent("phone:services:updateOpen", -1, job.name, onDuty == 1)
        end
    end

    playerJobs[source] = {
        job = job.name,
        onDuty = job.onDuty
    }

    if shouldRefresh then
        RefreshCompanies()
    end
end

---@param source number
local function UnloadJob(source)
    local job = playerJobs[source]

    if not job then
        debugprint("UnloadJob: job not found for", source)
        return
    end

    local jobName = job.job
    local onDuty = job.onDuty
    local jobCount = jobCounts[jobName]

    if not jobCount then
        debugprint("UnloadJob: jobCount not found for", jobName)
        return
    end

    jobCount.total -= 1

    if onDuty then
        jobCount.onDuty -= 1

        if jobCount.onDuty == 0 then
            TriggerClientEvent("phone:services:updateOpen", -1, jobName, false)
        end

        RefreshCompanies()
    end
end

AddEventHandler("esx:setJob", function(source, job, lastJob)
    OnJobUpdate(source, job, lastJob)
end)

AddEventHandler("esx:playerLoaded", function(source, xPlayer)
    OnJobUpdate(source, xPlayer.job)
end)

AddEventHandler("esx:playerLogout", function(source)
    UnloadJob(source)
end)

AddEventHandler("playerDropped", function()
    local src = source

    UnloadJob(src)
end)
