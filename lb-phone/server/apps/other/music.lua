local BaseCallback = BaseCallback

-- Cria uma nova playlist
BaseCallback("music:createPlaylist", function(source, phoneNumber, playlistName)
    local playlistId = MySQL.insert.await(
        "INSERT INTO phone_music_playlists (`name`, phone_number) VALUES (?, ?)",
        { playlistName, phoneNumber }
    )

    if not playlistId then return false end

    MySQL.update.await(
        "INSERT INTO phone_music_saved_playlists (playlist_id, phone_number) VALUES (?, ?)",
        { playlistId, phoneNumber }
    )

    return playlistId
end)

-- Edita uma playlist existente
BaseCallback("music:editPlaylist", function(source, phoneNumber, playlistId, newName, cover)
    local affected = MySQL.update.await(
        "UPDATE phone_music_playlists SET `name` = ?, cover = ? WHERE id = ? AND phone_number = ?",
        { newName, cover, playlistId, phoneNumber }
    )
    return affected > 0
end)

-- Obtém todas as playlists do usuário
BaseCallback("music:getPlaylists", function(source, phoneNumber)
    return MySQL.query.await([[
        SELECT s.song_id, p.id, p.`name`, p.cover, p.phone_number
        FROM phone_music_playlists p
        LEFT JOIN phone_music_saved_playlists p2 ON p2.playlist_id = p.id
        LEFT JOIN phone_music_songs s ON s.playlist_id = p.id
        WHERE p2.phone_number = ?
        ORDER BY p.`name` ASC
    ]], { phoneNumber })
end)

-- Remove uma playlist
BaseCallback("music:deletePlaylist", function(source, phoneNumber, playlistId)
    local affected = MySQL.update.await(
        "DELETE FROM phone_music_playlists WHERE id = ? AND phone_number = ?",
        { playlistId, phoneNumber }
    )
    return affected > 0
end)

-- Salva uma playlist para o usuário
BaseCallback("music:savePlaylist", function(source, phoneNumber, playlistId)
    local affected = MySQL.update.await(
        "INSERT INTO phone_music_saved_playlists (playlist_id, phone_number) VALUES (?, ?) ON DUPLICATE KEY UPDATE phone_number = phone_number",
        { playlistId, phoneNumber }
    )
    return affected > 0
end)

-- Adiciona uma música à playlist
BaseCallback("music:addSong", function(source, phoneNumber, playlistId, songId)
    -- Verifica se o usuário é dono da playlist
    local isOwner = MySQL.scalar.await(
        "SELECT 1 FROM phone_music_playlists WHERE id = ? AND phone_number = ?",
        { playlistId, phoneNumber }
    )
    if not isOwner then return false end

    local affected = MySQL.update.await(
        "INSERT INTO phone_music_songs (playlist_id, song_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE song_id = song_id",
        { playlistId, songId }
    )
    return affected > 0
end)

-- Remove uma música da playlist
BaseCallback("music:removeSong", function(source, phoneNumber, playlistId, songId)
    -- Verifica se o usuário é dono da playlist
    local isOwner = MySQL.scalar.await(
        "SELECT 1 FROM phone_music_playlists WHERE id = ? AND phone_number = ?",
        { playlistId, phoneNumber }
    )
    if not isOwner then return false end

    local affected = MySQL.update.await(
        "DELETE FROM phone_music_songs WHERE playlist_id = ? AND song_id = ?",
        { playlistId, songId }
    )
    return affected > 0
end)
