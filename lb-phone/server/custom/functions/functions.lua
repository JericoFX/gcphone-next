local anyExternalAllowed = false

for _, v in pairs(Config.AllowExternal) do
    if v then
        anyExternalAllowed = true
    end
end

---@param link string
---@return boolean allowed
function IsMediaLinkAllowed(link)
    if not Config.UploadWhitelistedDomains or #Config.UploadWhitelistedDomains == 0 then
        return true
    elseif anyExternalAllowed and #Config.ExternalWhitelistedDomains == 0 and #Config.ExternalBlacklistedDomains == 0 then
        return true
    end

    local domain = link:match("[%w%.]*%.(%w+%.%w+)")

    if not anyExternalAllowed then
        return table.contains(Config.UploadWhitelistedDomains, domain)
    elseif #Config.ExternalBlacklistedDomains > 0 and table.contains(Config.ExternalBlacklistedDomains, domain) then
        return false
    elseif #Config.ExternalWhitelistedDomains > 0 and not table.contains(Config.ExternalWhitelistedDomains, domain) then
        return false
    end

    return true
end

---@param username string
---@return boolean
function IsUsernameValid(username)
    if #username < 3 or #username > 20 then
        debugprint("Invalid username length", username)
        return false
    end

    if not Config.UsernameFilter or not Config.UsernameFilter.LuaPattern then
        return true
    end

    if not username:match(Config.UsernameFilter.LuaPattern) then
        debugprint("Invalid username", username)
        return false
    end

    return true
end

---@param source number
---@param uploadType "Audio" | "Image" | "Video"
---@return string? presignedUrl
function GetPresignedUrl(source, uploadType)
    local apiKey = API_KEYS[uploadType]

    infoprint("warning",
        "GetPresignedUrl has not been set up. Set it up in lb-phone/server/custom/functions/functions.lua, or change your upload method to Fivemanage.")
end

---@param source number
---@param plate string
---@param vehicle? number # The vehicle handle, if Config.ServerSideSpawn is enabled
function GiveVehicleKey(source, plate, vehicle)
end
