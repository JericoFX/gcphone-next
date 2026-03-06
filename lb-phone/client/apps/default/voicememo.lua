RegisterNUICallback("VoiceMemo", function(data, callback)
    if not currentPhone then return end

    local action = data.action
    debugprint("VoiceMemo:" .. (action or ""))
    -- Handle different voice memo actions
    if action == "upload" then
        TriggerCallback("voiceMemo:saveRecording", callback, data.data)
    elseif action == "get" then
        TriggerCallback("voiceMemo:getMemos", callback)
    elseif action == "delete" then
        TriggerCallback("voiceMemo:deleteMemo", callback, data.id)
    elseif action == "rename" then
        TriggerCallback("voiceMemo:renameMemo", callback, data.id, data.title)
    end
end)
