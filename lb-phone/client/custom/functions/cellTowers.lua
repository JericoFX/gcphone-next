local staticService = false
local currentService = 0

---@return 0 | 1 | 2 | 3 | 4
function GetServiceBars()
    if staticService then
        return staticService
    end

    return currentService
end

exports("SetServiceBars", function(bars)
    if not bars then
        staticService = false
        return
    end

    if type(bars) ~= "number" or bars < 0 or bars > 4 then
        error("Invalid service bars value, expected number between 0 and 4 or false")
    end

    staticService = bars
end)

local cellTowers = CellTowers

---@param playerCoords vector3
---@return number serviceBars
local function CalculateServiceBars(playerCoords)
    if not Config.CellTowers or not Config.CellTowers.Enabled then
        local currentZone = GetZoneAtCoords(playerCoords.x, playerCoords.y, playerCoords.z)
        local serviceBars = GetZoneScumminess(currentZone) - 1

        serviceBars = serviceBars < 0 and 0 or serviceBars

        if serviceBars < 2 and #(playerCoords - vector3(0, 0, 0)) < 3000 then
            serviceBars = 2
        end

        return serviceBars
    end

    local closestTower, closestDistance = nil, nil

    for i = 1, #cellTowers do
        local distance = #(playerCoords.xy - cellTowers[i].xy)

        if not closestDistance or distance < closestDistance then
            closestDistance = distance
            closestTower = i
        end
    end

    if not closestTower or not closestDistance then
        debugprint("CellTowers is empty?")
        return 3
    end

    for i = 4, 1, -1 do
        if closestDistance < Config.CellTowers.Range[i] then
            return i
        end
    end

    return 0
end

CreateThread(function()
    local lastCoords

    while true do
        local playerPed = PlayerPedId()
        local playerCoords = GetEntityCoords(playerPed)

        if not lastCoords or #(lastCoords - playerCoords) > 5.0 then
            lastCoords = playerCoords
            currentService = math.max(CalculateServiceBars(playerCoords), Config.CellTowers.MinService or 0)
        end

        Wait(500)
    end
end)

if Config.CellTowers.Debug then
    for i = 1, #cellTowers do
        local coords = cellTowers[i]

        AddBlipForCoord(coords.x, coords.y, coords.z)

        local one = AddBlipForRadius(coords.x, coords.y, coords.z, Config.CellTowers.Range[1])

        SetBlipAlpha(one, 16)
        SetBlipColour(one, 1)
    end

    for i = 1, #cellTowers do
        local coords = cellTowers[i]
        local two = AddBlipForRadius(coords.x, coords.y, coords.z, Config.CellTowers.Range[2])

        SetBlipAlpha(two, 32)
        SetBlipColour(two, 5)
    end

    for i = 1, #cellTowers do
        local coords = cellTowers[i]
        local three = AddBlipForRadius(coords.x, coords.y, coords.z, Config.CellTowers.Range[3])

        SetBlipAlpha(three, 64)
        SetBlipColour(three, 3)
    end

    for i = 1, #cellTowers do
        local coords = cellTowers[i]
        local four = AddBlipForRadius(coords.x, coords.y, coords.z, Config.CellTowers.Range[4])

        SetBlipAlpha(four, 128)
        SetBlipColour(four, 2)
    end
end
