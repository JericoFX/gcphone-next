local Bridge = require 'server.bridge'
local Utils = require 'server.lib.utils'

local UserCredentials = {}

local function GetTurnTokenId()
    local id = Utils.SafeString(GetConvar('webrtc_turn_token_id', ''), 120)
    return id and id ~= '' and id or nil
end

local function GetTurnApiToken()
    local token = Utils.SafeString(GetConvar('webrtc_turn_api_token', ''), 240)
    return token and token ~= '' and token or nil
end

local function RevokeCloudflareCredentials(source)
    local username = UserCredentials[source]
    if not username then return end

    local tokenId = GetTurnTokenId()
    local apiToken = GetTurnApiToken()
    if not tokenId or not apiToken then
        UserCredentials[source] = nil
        return
    end

    PerformHttpRequest(
        ('https://rtc.live.cloudflare.com/v1/turn/keys/%s/credentials/%s/revoke'):format(tokenId, username),
        function(status)
            if status >= 200 and status < 300 then
                print(('[gcphone:webrtc] Revoked TURN credentials for source=%d'):format(source))
            end
        end,
        'POST',
        '',
        { ['Authorization'] = 'Bearer ' .. apiToken }
    )

    UserCredentials[source] = nil
end

local function GetCloudflareIceServers(source)
    RevokeCloudflareCredentials(source)

    local tokenId = GetTurnTokenId()
    local apiToken = GetTurnApiToken()
    if not tokenId or not apiToken then
        print('[gcphone:webrtc] Missing webrtc_turn_token_id or webrtc_turn_api_token convars')
        return nil
    end

    local p = promise.new()

    PerformHttpRequest(
        ('https://rtc.live.cloudflare.com/v1/turn/keys/%s/credentials/generate-ice-servers'):format(tokenId),
        function(status, body)
            if status ~= 201 then
                print(('[gcphone:webrtc] Cloudflare TURN request failed, status=%d'):format(status))
                p:resolve(nil)
                return
            end

            local decoded = json.decode(body)
            if not decoded or not decoded.iceServers then
                print('[gcphone:webrtc] Invalid Cloudflare response')
                p:resolve(nil)
                return
            end

            p:resolve(decoded.iceServers)
        end,
        'POST',
        json.encode({ ttl = 86400 }),
        {
            ['Authorization'] = 'Bearer ' .. apiToken,
            ['Content-Type'] = 'application/json',
            ['Accept'] = 'application/json',
        }
    )

    local iceServers = Citizen.Await(p)

    if iceServers then
        for i = 1, #iceServers do
            if iceServers[i].username then
                UserCredentials[source] = iceServers[i].username
                break
            end
        end
    end

    return iceServers
end

lib.callback.register('gcphone:webrtc:getIceServers', function(source)
    local cfg = Config.WebRTC
    if not cfg then return nil end

    -- Issuing a Cloudflare TURN credential hits a metered API. Rate-limit
    -- per source so a spammy / malicious client cannot inflate the bill.
    -- The static fallback is cheap but we still want to cap churn.
    if Utils.HitRateLimit(source, 'webrtc_ice_servers', 30000, 2) then
        return nil
    end

    if cfg.DynamicTURN and cfg.DynamicTURN.Enabled then
        if cfg.DynamicTURN.Service == 'cloudflare' then
            local servers = GetCloudflareIceServers(source)
            if servers then
                if not cfg.DynamicTURN.RemoveDefaultStun then
                    table.insert(servers, 1, { urls = 'stun:stun.l.google.com:19302' })
                end
                return servers
            end
        end
    end

    if cfg.IceServers and #cfg.IceServers > 0 then
        return cfg.IceServers
    end

    return nil
end)

AddEventHandler('playerDropped', function()
    local src = source
    local cfg = Config.WebRTC
    if cfg and cfg.DynamicTURN and cfg.DynamicTURN.Enabled and cfg.DynamicTURN.Service == 'cloudflare' then
        RevokeCloudflareCredentials(src)
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= cache.resource then return end
    local cfg = Config.WebRTC
    if not cfg or not cfg.DynamicTURN or not cfg.DynamicTURN.Enabled then return end

    for src in pairs(UserCredentials) do
        if cfg.DynamicTURN.Service == 'cloudflare' then
            RevokeCloudflareCredentials(src)
        end
    end
end)

return {}
