local airShareAlbums = {}

BaseCallback("airShare:share", function(senderId, targetId, targetPlayerId, deviceType, shareData)
  local senderPlayer = Player(senderId)
  local senderPhoneName = senderPlayer and senderPlayer.state.phoneName

  if not senderPhoneName then
    debugprint("No sender name")
    return false
  end

  shareData.sender = {
    name = senderPhoneName,
    source = senderId,
    device = "phone"
  }

  if deviceType == "tablet" then
    if GetResourceState("lb-tablet") == "started" then
      local targetPlayer = Player(targetPlayerId)
      if targetPlayer and targetPlayer.state.lbTabletOpen then
        TriggerClientEvent("tablet:airShare:received", targetPlayerId, shareData)
      else
        return false
      end
    else
      return false
    end
  elseif deviceType == "phone" then
    local targetPlayer = Player(targetPlayerId)
    if not (targetPlayer and targetPlayer.state.phoneOpen) then
      debugprint("sendToSource's phone is not open")
      return false
    end
    TriggerClientEvent("phone:airShare:received", targetPlayerId, shareData)
  end

  if shareData.type == "album" then
    airShareAlbums[targetPlayerId] = airShareAlbums[targetPlayerId] or {}
    airShareAlbums[targetPlayerId][senderId] = shareData.album.id
  end

  return true
end)

RegisterNetEvent("phone:airShare:interacted", function(senderSource, senderDevice, accepted)
  local playerSource = source

  if type(senderSource) ~= "number" or type(senderDevice) ~= "string" then
    debugprint("AirShare:interacted: Invalid senderSource or senderDevice", senderSource, senderDevice)
    return
  end

  if senderDevice == "tablet" then
    TriggerClientEvent("tablet:airShare:interacted", senderSource, playerSource, accepted)
  elseif senderDevice == "phone" then
    TriggerClientEvent("phone:airShare:interacted", senderSource, playerSource, accepted)
  end

  local albumsForPlayer = airShareAlbums[playerSource]
  if albumsForPlayer and albumsForPlayer[senderSource] then
    local albumId = albumsForPlayer[senderSource]
    albumsForPlayer[senderSource] = nil
    if next(albumsForPlayer) == nil then
      airShareAlbums[playerSource] = nil
    end

    if not accepted then
      debugprint("AirShare: denied album share", albumId)
      return
    end

    debugprint("AirShare: accepted album share", albumId)
    HandleAcceptAirShareAlbum(playerSource, senderSource, albumId)
  end
end)

local validShareTypes = {
  image = true,
  contact = true,
  location = true,
  note = true,
  voicememo = true,
}

exports("AirShare", function(senderId, targetId, shareType, data)
  assert(type(senderId) == "number", "Invalid sender")
  assert(type(targetId) == "number", "Invalid target")
  assert(validShareTypes[shareType], "Invalid shareType")
  assert(type(data) == "table", "Invalid data")

  local senderPhoneNumber = GetEquippedPhoneNumber(senderId)
  if not senderPhoneNumber then
    return false
  end

  local sharePayload = {
    type = shareType,
    sender = {
      name = (Player(senderId) and Player(senderId).state.phoneName) or senderPhoneNumber,
      source = senderId,
      device = "phone"
    }
  }

  if shareType == "image" then
    sharePayload.attachment = data
    assert(data.src, "Invalid image data (missing src)")
    if not data.timestamp then
      data.timestamp = os.time() * 1000
    end
  elseif shareType == "contact" then
    sharePayload.contact = data
    assert(type(data.number) == "string", "Invalid/missing contact data (contact.number)")
    assert(type(data.firstname) == "string", "Invalid/missing contact data (contact.firstname)")
  elseif shareType == "location" then
    assert(data.location, "Invalid location data (missing location)")
    assert(type(data.name) == "string", "Invalid/missing location data (location.name)")
    sharePayload.location = data.location
    sharePayload.name = data.name
  elseif shareType == "note" then
    sharePayload.note = data
    assert(type(data.title) == "string", "Invalid/missing note data (note.title)")
    assert(type(data.content) == "string", "Invalid/missing note data (note.content)")
  elseif shareType == "voicememo" then
    sharePayload.voicememo = data
    assert(type(data.title) == "string", "Invalid/missing voicememo data (voicememo.title)")
    assert(type(data.src) == "string", "Invalid/missing voicememo data (voicememo.src)")
    assert(type(data.duration) == "number", "Invalid/missing voicememo data (voicememo.duration)")
  end

  TriggerClientEvent("phone:airShare:received", targetId, sharePayload)
end)

AddEventHandler("playerDropped", function()
  local playerSource = source
  airShareAlbums[playerSource] = nil
end)
