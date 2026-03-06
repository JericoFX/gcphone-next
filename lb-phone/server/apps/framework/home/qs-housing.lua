if Config.HouseScript ~= "qs-housing" then
    return
end

local function GetNameFromIdentifier(identifier)
    if Config.Framework == "esx" then
        local name = MySQL.single.await("SELECT firstname, lastname FROM users WHERE identifier = ?", { identifier })

        if name and name?.firstname and name?.lastname then
            return name.firstname .. " " .. name.lastname
        end
    elseif Config.Framework == "qb" or Config.Framework == "qbox" then
        local charinfo = MySQL.scalar.await("SELECT charinfo FROM players WHERE citizenid = ?", { identifier })

        charinfo = charinfo and json.decode(charinfo)

        if charinfo and charinfo.firstname and charinfo.lastname then
            return charinfo.firstname .. " " .. charinfo.lastname
        end
    end

    return identifier
end

local function FormatKeyholders(keyholders, ownerIdentifier)
    local formatted = {}

    for i = 1, #keyholders do
        local identifier = keyholders[i]

        if identifier ~= ownerIdentifier then
            formatted[#formatted + 1] = {
                identifier = identifier,
                name = GetNameFromIdentifier(identifier)
            }
        end
    end

    return formatted
end

RegisterCallback("home:getOwnedHouses", function(source)
    local identifier = GetIdentifier(source)
    local houses = MySQL.query.await([[
        SELECT
            ph.house,
            ph.keyholders,
            hl.label,
            hl.coords
        FROM
            player_houses ph
        LEFT JOIN
            houselocations hl ON hl.name = ph.house
        WHERE
            ph.owner = ?
        ORDER BY
            ph.house ASC
    ]], { identifier })

    for i = 1, #houses do
        local house = houses[i]
        local keyholders = house.keyholders and json.decode(house.keyholders) or {}

        house.keyholders = FormatKeyholders(keyholders, identifier)
        house.coords = house.coords and json.decode(house.coords)?.enter
        house.locked = false
    end

    return houses
end)

RegisterCallback("home:getKeyHolders", function(source, house)
    local identifier = GetIdentifier(source)
    local keyholders = MySQL.scalar.await("SELECT keyholders FROM player_houses WHERE owner = ? AND house = ?",
        { identifier, house })

    keyholders = keyholders and json.decode(keyholders) or {}

    return FormatKeyholders(keyholders, identifier)
end)
