if Config.Framework ~= "esx" then
    return
end

while not ESX do
    Wait(500)
    debugprint("Commands: Waiting for ESX to load")
end

if not ESX.RegisterCommand then
    infoprint("warning",
        "ESX.RegisterCommand not found, admin commands not registered. If you wish to use commands, update your ESX. The phone will still work. Do not ask us for help about this.")
    return
end

ESX.RegisterCommand("toggleverified", "admin", function(xPlayer, args, showError)
    local app, username, verified = args.app:lower(), args.username, args.verified

    local allowedApps = {
        ["twitter"] = true,
        ["instagram"] = true,
        ["tiktok"] = true,
        ["birdy"] = true,
        ["trendy"] = true,
        ["instapic"] = true
    }

    if not allowedApps[app] then
        return showError("No such app " .. tostring(app))
    end

    if not username then
        return showError("No username provided")
    end

    if verified ~= 1 and verified ~= 0 then
        return showError("Verified must be 1 or 0")
    end

    ToggleVerified(app, username, verified == 1)
end, false, {
    help = "Toggle verified for a user profile",
    arguments = {
        {
            name = "app",
            help = "The app: trendy, instapic or birdy",
            type = "any"
        },
        {
            name = "username",
            help = "The profile username",
            type = "any"
        },
        {
            name = "verified",
            help = "The verified state, 1 or 0",
            type = "number"
        }
    }
})

ESX.RegisterCommand("changepassword", "admin", function(xPlayer, args, showError)
    local app, username, password = args.app:lower(), args.username, args.password
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

    if not allowedApps[app] then
        return showError("No such app " .. tostring(app))
    elseif not username then
        return showError("No username provided")
    elseif not password then
        return showError("No password provided")
    end

    if not ChangePassword(app, username, password) then
        return showError("Failed to change password")
    end

    TriggerClientEvent("chat:addMessage", xPlayer.source, {
        color = { 0, 255, 0 },
        args = { "Success", "Password changed for " .. username }
    })
end, false, {
    help = "Change a user's password",
    arguments = {
        {
            name = "app",
            help = "Trendy, instapic, birdy, mail or darkchat",
            type = "any"
        },
        {
            name = "username",
            help = "The username/address",
            type = "any"
        },
        {
            name = "password",
            help = "The new password",
            type = "any"
        }
    }
})

ESX.RegisterCommand("resetphonesecurity", "admin", function(xPlayer, args, showError)
    local id = args.id
    local phoneNumber = GetEquippedPhoneNumber(id)

    if not phoneNumber then
        return showError("No phone number found for player " .. id)
    end

    ResetSecurity(phoneNumber)
end, false, {
    help = "Reset a user's phone security (pin code, face unlock)",
    arguments = {
        {
            name = "id",
            help = "The player id (source)",
            type = "number"
        }
    }
})
