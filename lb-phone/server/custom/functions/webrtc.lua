if not Config.DynamicWebRTC?.Enabled then
    return
end

if Config.DynamicWebRTC.Service == "cloudflare" then
    if not WEBRTC then
        return infoprint("error",
            "Dynamic WebRTC is enabled, but no credentials were found. Please set them in lb-phone/server/apiKeys.lua")
    end

    if not WEBRTC.TokenID or not WEBRTC.APIToken then
        if not WEBRTC.TokenID then
            infoprint("error",
                "Dynamic WebRTC is enabled, but no TokenID was found. Please set it in lb-phone/server/apiKeys.lua")
        end

        if not WEBRTC.APIToken then
            infoprint("error",
                "Dynamic WebRTC is enabled, but no APIToken was found. Please set it in lb-phone/server/apiKeys.lua")
        end

        return
    end

    debugprint("Dynamic WebRTC is enabled, using Cloudflare as the service.")
end

local userCredentials = {}

local function RevokeCredentialsCloudflare(source)
    local username = userCredentials[source]

    if not username then
        return
    end

    PerformHttpRequest(
    "https://rtc.live.cloudflare.com/v1/turn/keys/" .. WEBRTC.TokenID .. "/credentials/" .. username .. "/revoke",
        function(status, body, headers, errorData)
            if status >= 200 and status < 300 then
                debugprint("Successfully revoked credentials for user " .. source .. " (" .. username .. ").")
            else
                debugprint("Failed to revoke credentials for user " .. source .. " (" .. username .. ")")
                debugprint("Status:", status)
                debugprint("Body:", body)
                debugprint("Headers:", headers)
                debugprint("Error Data:", errorData)
            end
        end, "POST", "", {
        ["Authorization"] = "Bearer " .. WEBRTC.APIToken
    })

    userCredentials[source] = nil
end

---@return table?
local function GetCredentialsCloudflare(source)
    RevokeCredentialsCloudflare(source)

    local credentialsPromise = promise.new()

    PerformHttpRequest(
    "https://rtc.live.cloudflare.com/v1/turn/keys/" .. WEBRTC.TokenID .. "/credentials/generate-ice-servers",
        function(status, body, headers, errorData)
            if status ~= 201 then
                infoprint("error", "Failed to get WebRTC credentials from Cloudflare. Status: " .. status)
                print("Body:", body)
                print("Headers:", json.encode(headers))
                print("Error:", json.encode(errorData))

                credentialsPromise:resolve()

                return
            end

            local credentials = json.decode(body)

            if not credentials or not credentials.iceServers then
                infoprint("error", "Failed to get WebRTC credentials from Cloudflare. Invalid response:", body)

                credentialsPromise:resolve()

                return
            end

            credentialsPromise:resolve(credentials.iceServers)
        end, "POST", json.encode({
        ttl = 86400 -- 24 hours
    }), {
        ["Authorization"] = "Bearer " .. WEBRTC.APIToken,
        ["Content-Type"] = "application/json",
        ["Accept"] = "application/json",
    })

    local credentials = Citizen.Await(credentialsPromise)

    if credentials then
        local username

        for i = 1, #credentials do
            if credentials[i].username then
                username = credentials[i].username
                break
            end
        end

        userCredentials[source] = username
    end

    return credentials
end

RegisterCallback("getWebRTCCredentials", function(source)
    if Config.DynamicWebRTC.Service == "cloudflare" then
        return GetCredentialsCloudflare(source)
    end

    infoprint("error", "Dynamic WebRTC is enabled, but no service was found/set up.")
end)

AddEventHandler("playerDropped", function()
    local src = source

    if Config.DynamicWebRTC.Service == "cloudflare" then
        RevokeCredentialsCloudflare(src)
    end
end)

local function RevokeAllCredentials()
    for source in pairs(userCredentials) do
        if Config.DynamicWebRTC.Service == "cloudflare" then
            RevokeCredentialsCloudflare(source)
        end
    end
end

AddEventHandler("onResourceStop", function(resourceName)
    if resourceName == GetCurrentResourceName() then
        RevokeAllCredentials()
    end
end)

AddEventHandler("txAdmin:events:serverShuttingDown", function()
    RevokeAllCredentials()
end)
