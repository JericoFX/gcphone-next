if Config.Framework ~= "standalone" then
    return
end

---@param source number
---@param args string[]
---@param rawCommand string
RegisterCommand("toggleverified", function(source, args, rawCommand)
    local app = args[1] and args[1]:lower()
    local username = args[2]
    local verified = args[3] == "1"

    if not app or not username then
        return
    end

    local allowedApps = {
        -- old app names
        ["twitter"] = true,
        ["instagram"] = true,
        ["tiktok"] = true,

        ["birdy"] = true,
        ["trendy"] = true,
        ["instapic"] = true
    }

    if not allowedApps[app] then
        return
    end

    ToggleVerified(app, username, verified)
end, true)

---@param source number
---@param args string[]
---@param rawCommand string
RegisterCommand("changepassword", function(source, args, rawCommand)
    local app = args[1] and args[1]:lower()
    local username = args[2]
    local password = args[3]

    local allowedApps = {
        -- old app names
        ["twitter"] = true,
        ["instagram"] = true,
        ["tiktok"] = true,

        ["birdy"] = true,
        ["trendy"] = true,
        ["instapic"] = true,
        ["mail"] = true,
        ["darkchat"] = true
    }

    if not app or not username or not password or not allowedApps[app] then
        return
    end

    ChangePassword(app, username, password)
end, true)

---@param source number
---@param args string[]
---@param rawCommand string
RegisterCommand("resetphonesecurity", function(source, args, rawCommand)
    local target = args[1] and tonumber(args[1])
    local phoneNumber = target and GetEquippedPhoneNumber(target)

    if not phoneNumber then
        return
    end

    ResetSecurity(phoneNumber)
end, true)
