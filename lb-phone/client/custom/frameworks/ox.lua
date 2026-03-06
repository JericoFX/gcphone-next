if Config.Framework ~= "ox" then
    return
end

-- We have to use our own wrapper for ox_core as it uses ox_lib, breaking the phone.

OxPlayer = setmetatable({}, {
    __index = function(self, index)
        if index == "data" then
            return
        end

        return function(...)
            return exports.ox_core:CallPlayer(index, ...)
        end
    end
})

OxPlayer.data = exports.ox_core.GetPlayer() or {}

AddEventHandler("ox:playerLoaded", function(data)
    if OxPlayer.data.charId then return end

    for k, v in pairs(data) do
        OxPlayer.data[k] = v
    end

    FetchPhone()
end)

AddEventHandler("ox:playerLogout", function()
    table.wipe(OxPlayer.data)

    LogOut()
end)

while not OxPlayer.data.charId do
    Wait(500)
end

FrameworkLoaded = true

---@param itemName string
---@return boolean
function HasItem(itemName)
    return (exports.ox_inventory:Search("count", itemName) or 0) > 0
end

AddEventHandler("ox_inventory:updateInventory", function(changes)
    if Config.Item.Unique or not phoneOpen or not Config.Item.Require then
        return
    end

    if not HasPhoneItem() then
        OnDeath()
    end
end)

---@param jobs string[]
---@return boolean
function HasJob(jobs)
    local groups = OxPlayer.getGroups()

    for i = 1, #jobs do
        if groups[jobs[i]] and groups[jobs[i]] ~= 0 then
            return true
        end
    end

    return false
end

function GetCompanyData()
    local activeJob = OxPlayer.getGroupByType("job")

    if not activeJob then
        return { job = "unemployed", label = "Unemployed", isBoss = false }
    end

    local job, grade = table.unpack(activeJob)
    local jobData = GlobalState["group." .. job]
    local amountGrades = #jobData.grades
    local isBoss = grade == amountGrades and amountGrades > 1

    local companyData = {
        job = job,
        jobLabel = jobData.label,
        isBoss = isBoss
    }

    if not isBoss then
        return companyData
    end

    companyData.balance = AwaitCallback("services:getBalance")
    companyData.employees = AwaitCallback("services:getManagementEmployees")
    companyData.grades = {}

    for i = 1, amountGrades do
        companyData.grades[i] = {
            label = jobData.grades[i],
            grade = i
        }
    end

    for i = 1, #companyData.employees do
        local employee = companyData.employees[i]

        employee.canInteract = employee.grade ~= amountGrades
    end

    return companyData
end

function DepositMoney(amount)
    return AwaitCallback("services:depositMoney", amount)
end

function WithdrawMoney(amount)
    return AwaitCallback("services:withdrawMoney", amount)
end

function HireEmployee(source)
    return AwaitCallback("services:hireEmployee", source)
end

function FireEmployee(id)
    return AwaitCallback("services:fireEmployee", id)
end

function SetGrade(id, grade)
    return AwaitCallback("services:setGrade", id, grade)
end
