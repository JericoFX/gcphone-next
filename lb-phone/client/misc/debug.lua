RegisterCommand("phonedebug", function()
    Config.Debug = not Config.Debug

    SendReactMessage("toggleDebug", Config.Debug)
    print("DEBUG:", Config.Debug)
end, false)

local function RegisterDebugCommand(command, fn)
    RegisterCommand("phone" .. command, function(...)
        if not Config.Debug then
            return
        end

        fn(...)
    end, false)
end

RegisterDebugCommand("getcache", function()
    SendReactMessage("printCache")
end)

RegisterDebugCommand("getstacks", function()
    SendReactMessage("printStacks")
end)

if not Config.Debug then
    return
end

RegisterDebugCommand("notification", function()
    ---@type Notification
    local notification = {
        app = "Settings",
        title = "Test notification",
        content = "This is a test notification",
    }

    exports["lb-phone"]:SendNotification(notification)
end)

RegisterDebugCommand("togglecharging", function()
    exports["lb-phone"]:ToggleCharging(not exports["lb-phone"]:IsCharging())
end)

RegisterDebugCommand("setbattery", function(_, args)
    local battery = tonumber(args[1])

    if not battery or battery < 0 or battery > 100 then
        print("Invalid battery value. Must be between 0 and 100.")
        return
    end

    exports["lb-phone"]:SetBattery(battery)
end)
