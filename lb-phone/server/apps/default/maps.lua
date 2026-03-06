local BaseCallback = BaseCallback

-- Callback: maps:getSavedLocations
BaseCallback("maps:getSavedLocations", function(source, phoneNumber)
    local locations = MySQL.query.await(
        "SELECT id, `name`, x_pos, y_pos FROM phone_maps_locations WHERE phone_number = ? ORDER BY `name` ASC",
        { phoneNumber }
    )

    for i = 1, #locations do
        local location = locations[i]
        locations[i] = {
            id = location.id,
            name = location.name,
            position = { location.y_pos, location.x_pos }
        }
    end

    return locations
end, {})

-- Callback: maps:addLocation
BaseCallback("maps:addLocation", function(source, phoneNumber, name, xPos, yPos)
    return MySQL.insert.await(
        "INSERT INTO phone_maps_locations (phone_number, `name`, x_pos, y_pos) VALUES (?, ?, ?, ?)",
        { phoneNumber, name, xPos, yPos }
    )
end)

-- Callback: maps:renameLocation
BaseCallback("maps:renameLocation", function(source, phoneNumber, locationId, newName)
    local affectedRows = MySQL.update.await(
        "UPDATE phone_maps_locations SET `name` = ? WHERE id = ? AND phone_number = ?",
        { newName, locationId, phoneNumber }
    )
    return affectedRows > 0
end)

-- Callback: maps:removeLocation
BaseCallback("maps:removeLocation", function(source, phoneNumber, locationId)
    local affectedRows = MySQL.update.await(
        "DELETE FROM phone_maps_locations WHERE id = ? AND phone_number = ?",
        { locationId, phoneNumber }
    )
    return affectedRows > 0
end)
