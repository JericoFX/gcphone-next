-- Camera module configuration
local cameraConfig = {
    Audio = "audio",
    Image = "image",
    Video = "video"
}

local baseUrlCache = nil

-- Media types for statistics
local mediaTypes = {
    "videos", "photos", "favouritesVideos", "favouritesPhotos",
    "selfiesVideos", "selfiesPhotos", "screenshotsVideos", "screenshotsPhotos",
    "importsVideos", "importsPhotos", "duplicatesPhotos", "duplicatesVideos"
}

-- Valid metadata types
local validMetadata = {
    selfie = true,
    import = true,
    screenshot = true
}

-- Get base URL for camera
RegisterCallback("camera:getBaseUrl", function()
    if not baseUrlCache then
        baseUrlCache = GetConvar("web_baseUrl", "")
    end
    return baseUrlCache
end)

-- Get presigned URL for upload
RegisterCallback("camera:getPresignedUrl", function(source, uploadType)
    local mediaType = cameraConfig[uploadType]
    if not mediaType then return end

    local uploadMethod = Config.UploadMethod[uploadType]

    if uploadMethod ~= "Fivemanage" then
        if GetPresignedUrl then
            return GetPresignedUrl(source, uploadType)
        else
            infoprint("warning",
                "GetPresignedUrl has not been set up. Set it up in lb-phone/server/custom/functions/functions.lua, or change your upload method to Fivemanage.")
        end
        return
    end

    local promise = promise.new()

    PerformHttpRequest("https://fmapi.net/api/v2/presigned-url?fileType=" .. mediaType,
        function(status, body, headers, error)
            if status ~= 200 then
                infoprint("error", "Failed to get presigned URL from Fivemanage for " .. mediaType)
                print("Status:", status)
                print("Body:", body)
                print("Headers:", json.encode(headers or {}, { indent = true }))
                if error then print("Error:", error) end
                promise:resolve()
                return
            end

            local response = json.decode(body)
            promise:resolve(response and response.data and response.data.presignedUrl)
        end, "GET", "", {
        Authorization = API_KEYS[uploadType]
    })

    return Citizen.Await(promise)
end)

-- Handle voice recording peer IDs
RegisterNetEvent("phone:setListeningPeerId", function(peerId)
    if not Config.Voice.RecordNearby then return end

    local source = source
    local playerState = Player(source).state
    local currentPeerId = playerState.listeningPeerId

    if currentPeerId then
        TriggerClientEvent("phone:stoppedListening", -1, currentPeerId)
    end

    playerState.listeningPeerId = peerId
    debugprint(source, "set listeningPeerId to", peerId)

    if peerId then
        TriggerClientEvent("phone:startedListening", -1, source, peerId)
    end
end)

-- Clean up on player disconnect
AddEventHandler("playerDropped", function()
    local source = source
    local peerId = Player(source).state.listeningPeerId

    if peerId then
        debugprint(source, "dropped, listeningPeerId", peerId)
        TriggerClientEvent("phone:stoppedListening", -1, peerId)
    end
end)

-- Get upload API key with security check
RegisterCallback("camera:getUploadApiKey", function(source, uploadType)
    if not uploadType or not API_KEYS[uploadType] then return end

    if Config.UploadMethod[uploadType] == "Fivemanage" then
        DropPlayer(source, "Tried to abuse the upload system")
        return
    end

    return API_KEYS[uploadType]
end)

-- Notify album members about changes
local function notifyAlbumMembers(albumId, callback, includeOwner)
    local members = MySQL.query.await("SELECT phone_number FROM phone_photo_album_members WHERE album_id = ?", { albumId })

    if not includeOwner then
        local owner = MySQL.scalar.await("SELECT phone_number FROM phone_photo_albums WHERE id = ?", { albumId })
        if owner then
            members[#members + 1] = { phone_number = owner }
        end
    end

    for _, member in ipairs(members) do
        local source = GetSourceFromNumber(member.phone_number)
        callback(member.phone_number, source)
    end
end

-- Get album details
local function getAlbumDetails(albumId)
    local album = MySQL.single.await([[
      SELECT
          pa.id,
          pa.title,
          pa.shared,
          (
              SELECT pp_cover.link
              FROM phone_photos pp_cover
              JOIN phone_photo_album_photos ap_cover ON ap_cover.photo_id = pp_cover.id
              WHERE ap_cover.album_id = pa.id
              ORDER BY ap_cover.photo_id DESC
              LIMIT 1
          ) AS cover,
          SUM(CASE WHEN pp.is_video = 1 THEN 1 ELSE 0 END) AS videoCount,
          SUM(CASE WHEN pp.is_video = 0 THEN 1 ELSE 0 END) AS photoCount
      FROM phone_photo_albums pa
      LEFT JOIN phone_photo_album_photos ap ON ap.album_id = pa.id
      LEFT JOIN phone_photos pp ON pp.id = ap.photo_id
      WHERE pa.id = ?
      GROUP BY pa.id, pa.title, pa.shared, pa.phone_number
  ]], { albumId })

    if not album then return end

    album.photoCount = tonumber(album.photoCount) or 0
    album.videoCount = tonumber(album.videoCount) or 0
    album.count = album.photoCount + album.videoCount

    return album
end

-- Check album access permissions
local function checkAlbumAccess(phoneNumber, albumId)
    local album = MySQL.single.await(
        "SELECT phone_number, shared FROM phone_photo_albums WHERE id = ?",
        { albumId }
    )

    if not album then
        debugprint("DoesPhoneNumberHaveAccessToAlbum: Album not found", phoneNumber, albumId)
        return false
    end

    if not album.shared then
        if album.phone_number ~= phoneNumber then
            debugprint("DoesPhoneNumberHaveAccessToAlbum: Private album, not the owner", phoneNumber, albumId)
            return false
        end
    elseif album.shared then
        if album.phone_number ~= phoneNumber then
            local isMember = MySQL.scalar.await(
                "SELECT 1 FROM phone_photo_album_members WHERE album_id = ? AND phone_number = ?",
                { albumId, phoneNumber }
            )

            if not isMember then
                debugprint("DoesPhoneNumberHaveAccessToAlbum: Album is shared, but not a member", phoneNumber, albumId)
                return false
            end
        end
    end

    return album
end

-- Update album clients
local function updateAlbumClients(albumId)
    local album = getAlbumDetails(albumId)
    if not album then return end

    notifyAlbumMembers(albumId, function(_, source)
        if source then
            TriggerClientEvent("phone:photos:updateAlbum", source, album)
        end
    end, true)
end

-- Save media to gallery
BaseCallback("camera:saveToGallery", function(source, phoneNumber, link, size, isVideo, metadata, shouldLog)
    if not IsMediaLinkAllowed(link) then
        infoprint("error", ("%s %s tried to save an image with a link that is not allowed:"):format(source, phoneNumber),
            link)
        return false
    end

    if metadata and not validMetadata[metadata] then
        debugprint("Invalid metadata", metadata)
        metadata = nil
    end

    local photoId = MySQL.insert.await(
        "INSERT INTO phone_photos (phone_number, link, is_video, size, metadata) VALUES (?, ?, ?, ?, ?)",
        { phoneNumber, link, isVideo == true, size or 0, metadata }
    )

    if shouldLog then
        Log("Uploads", source, "info",
            L("BACKEND.LOGS.UPLOADED_MEDIA"),
            L("BACKEND.LOGS.UPLOADED_MEDIA_DESCRIPTION", {
                type = isVideo and L("BACKEND.LOGS.VIDEO") or L("BACKEND.LOGS.PHOTO"),
                id = photoId,
                link = link
            }),
            link
        )
        TrackSimpleEvent(isVideo and "take_video" or "take_photo")
    end

    return photoId
end)

-- Delete media from gallery
BaseCallback("camera:deleteFromGallery", function(source, phoneNumber, photoIds)
    MySQL.update.await(
        "DELETE FROM phone_photos WHERE phone_number = ? AND id IN (?)",
        { phoneNumber, photoIds }
    )
    return true
end)

-- Toggle media favorites
BaseCallback("camera:toggleFavourites", function(source, phoneNumber, shouldFavorite, photoIds)
    MySQL.update.await(
        "UPDATE phone_photos SET is_favourite = ? WHERE phone_number = ? AND id IN (?)",
        { shouldFavorite == true, phoneNumber, photoIds }
    )
    return true
end)

-- Get media with filters
BaseCallback("camera:getImages", function(source, phoneNumber, filters, page)
    if not filters.showVideos and not filters.showPhotos then
        return {}
    end

    local params = { phoneNumber }
    local whereClauses = { "phone_number = ?" }

    if filters.showPhotos ~= filters.showVideos then
        table.insert(whereClauses, "(is_video = ? OR is_video != ?)")
        table.insert(params, filters.showVideos == true)
        table.insert(params, filters.showPhotos == true)
    end

    if filters.favourites == true then
        table.insert(whereClauses, "is_favourite = 1")
    end

    if filters.type then
        table.insert(whereClauses, "metadata = ?")
        table.insert(params, filters.type)
    end

    if filters.album then
        if not checkAlbumAccess(phoneNumber, filters.album) then
            debugprint("getImages: No access to album", phoneNumber, filters.album)
            return {}
        end

        -- Replace the phone number filter with album filter
        table.remove(whereClauses, 1)
        table.remove(params, 1)

        table.insert(whereClauses, "id IN (SELECT ap.photo_id FROM phone_photo_album_photos ap WHERE ap.album_id = ?)")
        table.insert(params, filters.album)
    end

    if filters.duplicates then
        table.insert(whereClauses, [[
          link IN (
              SELECT link FROM phone_photos
              WHERE phone_number = ?
              GROUP BY link
              HAVING COUNT(1) > 1
          )
      ]])
        table.insert(params, phoneNumber)
    end

    local perPage = math.clamp(filters.perPage or 32, 1, 32)
    local offset = (page or 0) * perPage

    local query = [[
      SELECT id, link, is_video, size, metadata, is_favourite, `timestamp`
      FROM phone_photos
      {WHERE}
      ORDER BY `timestamp` DESC
      LIMIT ?, ?
  ]]

    query = query:gsub("{WHERE}", #whereClauses > 0 and "WHERE " .. table.concat(whereClauses, " AND ") or "")

    table.insert(params, offset)
    table.insert(params, perPage)

    return MySQL.query.await(query, params)
end)

-- Get most recent media
BaseCallback("camera:getLastImage", function(source, phoneNumber)
    return MySQL.scalar.await(
        "SELECT link FROM phone_photos WHERE phone_number = ? ORDER BY id DESC LIMIT 1",
        { phoneNumber }
    )
end)

-- Album management functions
BaseCallback("camera:createAlbum", function(source, phoneNumber, title)
    return MySQL.insert.await(
        "INSERT INTO phone_photo_albums (phone_number, title) VALUES (?, ?)",
        { phoneNumber, title }
    )
end)

BaseCallback("camera:renameAlbum", function(source, phoneNumber, albumId, newTitle)
    local affected = MySQL.update.await(
        "UPDATE phone_photo_albums SET title = ? WHERE phone_number = ? AND id = ?",
        { newTitle, phoneNumber, albumId }
    ) > 0

    if affected then
        local isShared = MySQL.scalar.await(
            "SELECT shared FROM phone_photo_albums WHERE id = ?",
            { albumId }
        )

        if isShared then
            notifyAlbumMembers(albumId, function(_, source)
                if source then
                    TriggerClientEvent("phone:photos:renameAlbum", source, albumId, newTitle)
                end
            end, true)
        end
    end

    return affected
end)

BaseCallback("camera:addToAlbum", function(source, phoneNumber, albumId, photoIds)
    local album = checkAlbumAccess(phoneNumber, albumId)
    if not album then
        debugprint("No access to album", phoneNumber, albumId)
        return false
    end

    MySQL.update.await([[
      INSERT IGNORE INTO phone_photo_album_photos (album_id, photo_id)
      SELECT ?, id FROM phone_photos WHERE phone_number = ? AND id IN (?)
  ]], { albumId, phoneNumber, photoIds })

    debugprint("Added photos to album", phoneNumber, albumId, photoIds)

    if album.shared then
        updateAlbumClients(albumId)
    end

    return true
end)

BaseCallback("camera:removeFromAlbum", function(source, phoneNumber, albumId, photoIds)
    local album = checkAlbumAccess(phoneNumber, albumId)
    if not album then
        debugprint("No access to album", phoneNumber, albumId)
        return false
    end

    MySQL.update.await(
        "DELETE FROM phone_photo_album_photos WHERE album_id = ? AND photo_id IN (?)",
        { albumId, photoIds }
    )

    updateAlbumClients(albumId)
    return true
end)

BaseCallback("camera:deleteAlbum", function(source, phoneNumber, albumId)
    local album = MySQL.single.await(
        "SELECT shared FROM phone_photo_albums WHERE phone_number = ? AND id = ?",
        { phoneNumber, albumId }
    )

    if not album then
        debugprint("deleteAlbum: Album not found", phoneNumber, albumId)
        return false
    end

    if album.shared then
        notifyAlbumMembers(albumId, function(memberPhone, source)
            if source then
                TriggerClientEvent("phone:photos:removeMemberFromAlbum", source, albumId, memberPhone)
            end
        end, false)
    end

    MySQL.update.await(
        "DELETE FROM phone_photo_albums WHERE phone_number = ? AND id = ?",
        { phoneNumber, albumId }
    )

    return true
end)

-- Get homepage data with statistics
BaseCallback("camera:getHomePageData", function(source, phoneNumber)
    local stats = MySQL.single.await([[
      SELECT
          SUM(is_video = 1) AS videos,
          SUM(is_video = 0) AS photos,
          SUM(is_video = 1 AND is_favourite = 1) AS favouritesVideos,
          SUM(is_video = 0 AND is_favourite = 1) AS favouritesPhotos,
          SUM(metadata = 'selfie' AND is_video = 1) AS selfiesVideos,
          SUM(metadata = 'selfie' AND is_video = 0) AS selfiesPhotos,
          SUM(metadata = 'screenshot' AND is_video = 1) AS screenshotsVideos,
          SUM(metadata = 'screenshot' AND is_video = 0) AS screenshotsPhotos,
          SUM(metadata = 'import' AND is_video = 1) AS importsVideos,
          SUM(metadata = 'import' AND is_video = 0) AS importsPhotos,
          SUM(CASE WHEN is_video = 0 THEN 1 ELSE 0 END) - COUNT(DISTINCT CASE WHEN is_video = 0 THEN link END) AS duplicatesPhotos,
          SUM(CASE WHEN is_video = 1 THEN 1 ELSE 0 END) - COUNT(DISTINCT CASE WHEN is_video = 1 THEN link END) AS duplicatesVideos
      FROM phone_photos
      WHERE phone_number = ?
  ]], { phoneNumber })

    -- Initialize all stats to 0 and convert to numbers
    for _, stat in ipairs(mediaTypes) do
        stats[stat] = tonumber(stats[stat]) or 0
    end

    -- Adjust duplicate counts
    if stats.duplicatesPhotos > 0 then stats.duplicatesPhotos = stats.duplicatesPhotos + 1 end
    if stats.duplicatesVideos > 0 then stats.duplicatesVideos = stats.duplicatesVideos + 1 end

    -- Create default albums
    local albums = {
        {
            id = "recents",
            title = L("APPS.PHOTOS.RECENTS"),
            videoCount = stats.videos,
            photoCount = stats.photos,
            cover = MySQL.scalar.await(
                "SELECT link FROM phone_photos WHERE phone_number = ? ORDER BY id DESC LIMIT 1",
                { phoneNumber }
            ),
            removable = false
        },
        {
            id = "favourites",
            title = L("APPS.PHOTOS.FAVOURITES"),
            videoCount = stats.favouritesVideos,
            photoCount = stats.favouritesPhotos,
            cover = MySQL.scalar.await(
                "SELECT link FROM phone_photos WHERE phone_number = ? AND is_favourite = 1 ORDER BY id DESC LIMIT 1",
                { phoneNumber }
            ),
            removable = false
        }
    }

    -- Get user albums
    local userAlbums = MySQL.query.await([[
      SELECT
          pa.id,
          pa.title,
          pa.shared,
          pa.phone_number,
          (
              SELECT pp_cover.link
              FROM phone_photos pp_cover
              JOIN phone_photo_album_photos ap_cover ON ap_cover.photo_id = pp_cover.id
              WHERE ap_cover.album_id = pa.id
              ORDER BY ap_cover.photo_id DESC
              LIMIT 1
          ) AS cover,
          SUM(CASE WHEN pp.is_video = 1 THEN 1 ELSE 0 END) AS videoCount,
          SUM(CASE WHEN pp.is_video = 0 THEN 1 ELSE 0 END) AS photoCount
      FROM phone_photo_albums pa
      LEFT JOIN phone_photo_album_photos ap ON ap.album_id = pa.id
      LEFT JOIN phone_photos pp ON pp.id = ap.photo_id
      WHERE pa.phone_number = ?
          OR EXISTS (
              SELECT 1 FROM phone_photo_album_members member
              WHERE member.album_id = pa.id AND member.phone_number = ?
          )
      GROUP BY pa.id, pa.title, pa.shared, pa.phone_number
      ORDER BY pa.id ASC
  ]], { phoneNumber, phoneNumber })

    -- Process user albums
    for _, album in ipairs(userAlbums) do
        album.removable = true
        album.isOwner = album.phone_number == phoneNumber
        album.phone_number = nil

        album.photoCount = tonumber(album.photoCount) or 0
        album.videoCount = tonumber(album.videoCount) or 0
        album.count = album.photoCount + album.videoCount

        albums[#albums + 1] = album
    end

    return {
        albums = albums,
        mediaTypes = stats
    }
end, { albums = {}, mediaTypes = {} })

-- Get album members
BaseCallback("camera:getAlbumMembers", function(source, phoneNumber, albumId)
    local album = checkAlbumAccess(phoneNumber, albumId)
    if not album then
        debugprint("getAlbumMembers: No access to album", phoneNumber, albumId)
        return false
    end

    local members = {}
    local owner = MySQL.scalar.await(
        "SELECT phone_number FROM phone_photo_albums WHERE id = ?",
        { albumId }
    )

    local memberNumbers = MySQL.query.await(
        "SELECT phone_number FROM phone_photo_album_members WHERE album_id = ?",
        { albumId }
    )

    for _, member in ipairs(memberNumbers) do
        members[#members + 1] = member.phone_number
    end

    members[#members + 1] = owner
    return members
end)

-- Remove member from album
local function removeAlbumMember(memberPhone, albumId)
    local affected = MySQL.update.await(
        "DELETE FROM phone_photo_album_members WHERE album_id = ? AND phone_number = ?",
        { albumId, memberPhone }
    ) > 0

    if not affected then
        debugprint("removeMemberFromAlbum: failed to remove member from album", memberPhone, albumId)
        return false
    end

    local memberCount = MySQL.scalar.await(
        "SELECT COUNT(1) FROM phone_photo_album_members WHERE album_id = ?",
        { albumId }
    )

    -- If no members left, make album private
    if memberCount == 0 then
        MySQL.update.await(
            "UPDATE phone_photo_albums SET shared = 0 WHERE id = ?",
            { albumId }
        )
    end

    -- Notify all members about the removal
    notifyAlbumMembers(albumId, function(_, source)
        if source then
            TriggerClientEvent("phone:photos:removeMemberFromAlbum", source, albumId, memberPhone)
        end
    end, true)

    -- Notify the removed member if online
    local memberSource = GetSourceFromNumber(memberPhone)
    if memberSource then
        TriggerClientEvent("phone:photos:removeMemberFromAlbum", memberSource, albumId, memberPhone)
    end

    return true
end

-- Owner removes member from album
BaseCallback("camera:removeMemberFromAlbum", function(source, phoneNumber, memberPhone, albumId)
    local isOwner = MySQL.scalar.await(
        "SELECT 1 FROM phone_photo_albums WHERE id = ? AND phone_number = ?",
        { albumId, phoneNumber }
    )

    if not isOwner then
        debugprint("removeMemberFromAlbum: not the owner of the album", phoneNumber, albumId)
        return
    end

    return removeAlbumMember(memberPhone, albumId)
end)

-- Member leaves shared album
BaseCallback("camera:leaveSharedAlbum", function(source, phoneNumber, albumId)
    removeAlbumMember(phoneNumber, albumId)
    return true
end)

-- Handle accepting shared album via AirShare
function HandleAcceptAirShareAlbum(source, sender, albumId)
    local senderPhone = GetEquippedPhoneNumber(sender)
    local recipientPhone = GetEquippedPhoneNumber(source)

    if not senderPhone or not recipientPhone then
        debugprint("HandleAcceptAirShareAlbum: senderPhone/recipientPhone not found", senderPhone, recipientPhone)
        return
    end

    -- Check if already a member
    local isMember = MySQL.scalar.await(
        "SELECT 1 FROM phone_photo_album_members WHERE album_id = ? AND phone_number = ?",
        { albumId, recipientPhone }
    )

    if isMember then
        debugprint("HandleAcceptAirShareAlbum: recipient is already a member of the album", senderPhone, recipientPhone,
            albumId)
        return
    end

    -- Verify sender is owner
    local isOwner = MySQL.scalar.await(
        "SELECT 1 FROM phone_photo_albums WHERE id = ? AND phone_number = ?",
        { albumId, senderPhone }
    )

    if not isOwner then
        debugprint("HandleAcceptAirShareAlbum: sender is not the owner of the album", senderPhone, recipientPhone,
            albumId)
        return
    end

    -- Make album shared if not already
    MySQL.update.await(
        "UPDATE phone_photo_albums SET shared = 1 WHERE id = ?",
        { albumId }
    )

    local albumData = getAlbumDetails(albumId)
    if not albumData then
        debugprint("HandleAcceptAirShareAlbum: albumData not found", senderPhone, recipientPhone, albumId)
        return
    end

    -- Notify all members except sender about new member
    notifyAlbumMembers(albumId, function(memberPhone, memberSource)
        if memberSource ~= sender then
            TriggerClientEvent("phone:photos:addMemberToAlbum", memberSource, albumId, recipientPhone)
        end
    end, false)

    -- Add recipient as member
    MySQL.insert.await(
        "INSERT INTO phone_photo_album_members (album_id, phone_number) VALUES (?, ?) ON DUPLICATE KEY UPDATE phone_number = ?",
        { albumId, recipientPhone, recipientPhone }
    )

    -- Notify recipient
    TriggerClientEvent("phone:photos:addSharedAlbum", source, albumData)
end
