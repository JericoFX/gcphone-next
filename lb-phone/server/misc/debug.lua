RegisterCommand("svphonedebug", function()
    Config.Debug = not Config.Debug

    infoprint("info", "Server Debug " .. (Config.Debug and "enabled" or "disabled"))
    Wait(0)
    infoprint("info", "Server Debug " .. (Config.Debug and "enabled" or "disabled"))
end, true)
