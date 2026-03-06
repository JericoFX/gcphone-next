if Config.Framework ~= "qbox" then
    return
end

while not QB do
    Wait(500)
    debugprint("Services: Waiting for QBox to load")
end

RegisterNetEvent("QBCore:Client:SetDuty", function(onDuty)
    PlayerJob.onduty = onDuty

    SendReactMessage("services:setDuty", onDuty)
end)

RegisterNetEvent("QBCore:Client:OnJobUpdate", function(jobInfo)
    local oldJob = PlayerJob

    PlayerJob = jobInfo

    if oldJob.name ~= PlayerJob.name or oldJob.grade?.level ~= PlayerJob.grade?.level then
        SendReactMessage("services:setCompany", GetCompanyData())
    end

    TriggerEvent("lb-phone:jobUpdated", {
        job = PlayerJob.name,
        grade = PlayerJob.grade.level
    })
end)

---@return string
function GetJob()
    return PlayerJob?.name or "unemployed"
end

---@return number
function GetJobGrade()
    return PlayerJob?.grade?.level or 0
end

function GetCompanyData()
    local jobData = {
        job = PlayerJob.name,
        jobLabel = PlayerJob.label,
        isBoss = PlayerJob.isboss,
        duty = PlayerJob.onduty
    }

    if not jobData.isBoss then
        return jobData
    end

    jobData.balance = AwaitCallback("qbx:services:getAccount")
    jobData.employees = AwaitCallback("qbx:services:getEmployees")
    jobData.grades = {}

    for k, v in pairs(QB.Shared.Jobs[jobData.job].grades) do
        jobData.grades[#jobData.grades + 1] = {
            label = v.name,
            grade = tonumber(k)
        }
    end

    table.sort(jobData.grades, function(a, b)
        return a.grade < b.grade
    end)

    return jobData
end

function DepositMoney(amount)
    return AwaitCallback("qbx:services:addMoney", amount)
end

function WithdrawMoney(amount)
    return AwaitCallback("qbx:services:removeMoney", amount)
end

function HireEmployee(source)
    if not AwaitCallback("qbx:services:hireEmployee", source) then
        return false
    end

    return AwaitCallback("services:getPlayerData", source)
end

function FireEmployee(citizenid)
    return AwaitCallback("qbx:services:fireEmployee", citizenid)
end

function SetGrade(identifier, newGrade)
    local maxGrade = 0

    for grade, _ in pairs(QB.Shared.Jobs[PlayerJob.name].grades) do
        grade = tonumber(grade)

        if grade and grade > maxGrade then
            maxGrade = grade
        end
    end

    if newGrade > maxGrade then
        return false
    end

    return AwaitCallback("qbx:services:setGrade", identifier, newGrade)
end

function ToggleDuty()
    TriggerServerEvent("QBCore:ToggleDuty")
end
