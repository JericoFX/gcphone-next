local function fetchPlaylists()
  local rawPlaylists = AwaitCallback("music:getPlaylists")
  local processedPlaylists = {}
  local addedIds = {}

  for i = 1, #rawPlaylists do
    local item = rawPlaylists[i]
    if not addedIds[item.id] then
      addedIds[item.id] = true

      local playlist = {
        Id = item.id,
        Title = item.name,
        Cover = item.cover,
        IsOwner = (item.phone_number == currentPhone),
        Songs = {}
      }
      table.insert(processedPlaylists, playlist)
    end

    if item.song_id then
      local lastPlaylist = processedPlaylists[#processedPlaylists]
      table.insert(lastPlaylist.Songs, item.song_id)
    end
  end

  return processedPlaylists
end

local function handleMusicNUIRequest(data, callback)
  local action = data.action or ""
  debugprint("Music: " .. action)

  if action == "getConfig" then
    callback(Music)
  elseif action == "createPlaylist" then
    TriggerCallback("music:createPlaylist", callback, data.name)
  elseif action == "editPlaylist" then
    TriggerCallback("music:editPlaylist", callback, data.id, data.title, data.cover)
  elseif action == "getPlaylists" then
    local playlists = fetchPlaylists()
    callback(playlists)
  elseif action == "deletePlaylist" then
    TriggerCallback("music:deletePlaylist", callback, data.id)
  elseif action == "savePlaylist" then
    TriggerCallback("music:savePlaylist", callback, data.id)
  elseif action == "addSong" then
    TriggerCallback("music:addSong", callback, data.id, data.song)
  elseif action == "removeSong" then
    TriggerCallback("music:removeSong", callback, data.id, data.song)
  end
end

RegisterNUICallback("Music", handleMusicNUIRequest)
