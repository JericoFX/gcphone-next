RegisterNetEvent('gcphone:nearbyVoice:setPeerId', function(peerId)
    local source = source
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
