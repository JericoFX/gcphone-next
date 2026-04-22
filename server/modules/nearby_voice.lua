local Bridge = require 'server.bridge'
local Utils = require 'server.lib.utils'

RegisterNetEvent('gcphone:nearbyVoice:setPeerId', function(peerId)
    local source = source

    -- Event triggers a global (-1) client broadcast on every call. Require an
    -- authenticated identifier, cap peerId size, and rate-limit so a malicious
    -- client cannot flood every connected player with start/stop events.
    if not Bridge.GetIdentifier(source) then return end
    if peerId ~= nil and type(peerId) ~= 'string' then return end
    if type(peerId) == 'string' and #peerId > 128 then return end
    if Utils.HitRateLimit(source, 'nearby_voice_set', 500, 3) then return end

    local state = Player(source).state
    local previous = state.gcphoneListeningPeerId

    if type(previous) == 'string' and previous ~= '' then
        TriggerClientEvent('gcphone:nearbyVoice:stopped', -1, previous)
    end

    local nextPeerId = nil
    if type(peerId) == 'string' and peerId ~= '' then
        nextPeerId = peerId
    end

    state:set('gcphoneListeningPeerId', nextPeerId, true)

    if nextPeerId then
        TriggerClientEvent('gcphone:nearbyVoice:started', -1, source, nextPeerId)
    end
end)

AddEventHandler('playerDropped', function()
    local source = source
    local state = Player(source).state
    local peerId = state.gcphoneListeningPeerId
    if type(peerId) == 'string' and peerId ~= '' then
        TriggerClientEvent('gcphone:nearbyVoice:stopped', -1, peerId)
    end
    state:set('gcphoneListeningPeerId', nil, true)
end)

return {}
