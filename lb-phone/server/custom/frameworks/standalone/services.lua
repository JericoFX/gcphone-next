if Config.Framework ~= "standalone" then
    return
end

---@param source number
---@return string
function GetJob(source)
    return "unemployed"
end

---Get all players with a specific job (including offline players)
---@param job string
---@return { firstname: string, lastname: string, grade: string, number: string }[] employees
function GetAllEmployees(job)
    return {}
end

---Get all online players with a specific job
---@param job string
---@return number[] # An array of sources with this job
function GetEmployees(job)
    return {}
end

---Refresh all companies and update the open status
function RefreshCompanies()
    for i = 1, #Config.Companies.Services do
        -- Implement your own logic to check if the job is open
        local jobData = Config.Companies.Services[i]

        jobData.open = false
    end
end
