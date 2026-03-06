if Config.Framework ~= "standalone" then
    return
end

---@return string
function GetJob()
    return "unemployed"
end

---@return number
function GetJobGrade()
    return 0
end

---CompanyData can be found in lb-phone/client/apps/framework/services.lua
---@param cb fun(companyData: CompanyData)
---@return CompanyData? companyData
function GetCompanyData(cb)
    local companyData = {
        job = GetJob(),
        jobLabel = "Unemployed",
        isBoss = false,
        duty = nil
    }

    return companyData
end

---@param amount number
---@param cb fun(newBalance: number)
---@return number? newBalance
function DepositMoney(amount, cb)
    return 0
end

---@param amount number
---@param cb fun(newBalance: number)
---@return number? newBalance
function WithdrawMoney(amount, cb)
    return 0
end

---@param source number
---@param cb fun(employee: { id: number, name: string })
---@return { id: number, name: string } | false | nil employee
function HireEmployee(source, cb)
    return false
end

---@param id any
---@param cb fun(success: boolean)
---@return boolean? success
function FireEmployee(id, cb)
    return false
end

---@param id any
---@param newGrade number
---@param cb fun(success: boolean)
---@return boolean? success
function SetGrade(id, newGrade, cb)
    return false
end

---@param duty boolean
function ToggleDuty(duty)
end
