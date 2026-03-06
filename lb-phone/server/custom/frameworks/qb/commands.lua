if Config.Framework ~= "qb" then
    return
end

while not QB do
    Wait(500)
    debugprint("Commands: Waiting for QB to load")
end

QB.Commands.Add("toggleverified", "Toggle verified for a user profile", {
    {
        name = "app",
        help = "The app: trendy, instapic or birdy"
    },
    {
        name = "username",
        help = "The profile username"
    },
    {
        name = "verified",
        help = "The verified state, 1 or 0"
    }
}, true, function(_, args)
    local app, username, verified = args[1], args[2], tonumber(args[3])

    local allowedApps = {
        ["twitter"] = true,
        ["instagram"] = true,
        ["tiktok"] = true,
        ["birdy"] = true,
        ["trendy"] = true,
        ["instapic"] = true
    }

    if not allowedApps[app:lower()] or (not username) or (verified ~= 1 and verified ~= 0) then
        return
    end

    ToggleVerified(app, username, verified == 1)
end, "admin")

QB.Commands.Add("changepassword", "Change a user's password", {
    {
        name = "app",
        help = "trendy, instapic, birdy, mail or darkchat"
    },
    {
        name = "username",
        help = "The username/address"
    },
    {
        name = "password",
        help = "The new password"
    }
}, true, function(_, args)
    local app, username, password = args[1], args[2], args[3]
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

    if not allowedApps[app:lower()] then
        return
    elseif not username then
        return
    elseif not password then
        return
    end

    ChangePassword(app, username, password)
end, "admin")

QB.Commands.Add("resetphonesecurity", "Reset a user's phone security (pin code, face unlock)", {
    {
        name = "id",
        help = "The player id (source)"
    }
}, true, function(_, args)
    local id = args[1] and tonumber(args[1])
    local phoneNumber = id and GetEquippedPhoneNumber(id)

    if not phoneNumber then
        return
    end

    ResetSecurity(phoneNumber)
end)
