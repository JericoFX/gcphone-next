local isUpdatingCoords = false
local playerPed = PlayerPedId()
local currentCoords = vector3(0, 0, 0)

-- Função para adicionar uma nova localização
local function addNewLocation(name, position)
    if not name then
        return false
    end

    local coords = position and vector2(position[2], position[1]) or GetEntityCoords(playerPed)

    local locationId = AwaitCallback("maps:addLocation", name, coords.x, coords.y)
    if not locationId then
        return false
    end

    local newLocation = {
        id = locationId,
        name = name,
        position = { coords.y, coords.x }
    }

    SavedLocations[#SavedLocations + 1] = newLocation
    return newLocation
end

-- Função para atualizar as coordenadas do jogador
local function updatePlayerCoords()
    playerPed = PlayerPedId()
    currentCoords = GetEntityCoords(playerPed)

    SendReactMessage("maps:updateCoords", {
        x = math.floor(currentCoords.x + 0.5),
        y = math.floor(currentCoords.y + 0.5)
    })

    while isUpdatingCoords do
        if phoneOpen then
            local newCoords = GetEntityCoords(playerPed)
            if #(currentCoords - newCoords) > 1.0 then
                currentCoords = newCoords
                SendReactMessage("maps:updateCoords", {
                    x = math.floor(newCoords.x + 0.5),
                    y = math.floor(newCoords.y + 0.5)
                })
            end
        end
        Wait(250)
    end
end

-- Callback NUI para funcionalidades do mapa
RegisterNUICallback("Maps", function(data, callback)
    debugprint("Maps:" .. (data.action or ""))

    if data.action == "getCurrentLocation" then
        local coords = GetEntityCoords(PlayerPedId())
        callback({ x = coords.x, y = coords.y })
    elseif data.action == "toggleUpdateCoords" then
        callback("ok")
        if isUpdatingCoords ~= data.toggle then
            isUpdatingCoords = data.toggle == true
            updatePlayerCoords()
        end
    elseif data.action == "setWaypoint" then
        callback("ok")
        local x = tonumber(data.data.x)
        local y = tonumber(data.data.y)
        if x and y then
            SetNewWaypoint(x / 1, y / 1)
        end
    elseif data.action == "getLocations" then
        callback(SavedLocations)
    elseif data.action == "addLocation" then
        callback(addNewLocation(data.name, data.location))
    elseif data.action == "renameLocation" then
        local newName = data.name
        if not newName or not AwaitCallback("maps:renameLocation", data.id, newName) then
            callback(false)
            return
        end

        for i, location in ipairs(SavedLocations) do
            if location.id == data.id then
                location.name = newName
                break
            end
        end
        callback(true)
    elseif data.action == "removeLocation" then
        if not AwaitCallback("maps:removeLocation", data.id) then
            callback(false)
            return
        end

        for i, location in ipairs(SavedLocations) do
            if location.id == data.id then
                table.remove(SavedLocations, i)
                break
            end
        end
        callback(true)
    end
end)
