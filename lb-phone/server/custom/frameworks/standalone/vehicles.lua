if Config.Framework ~= "standalone" then
    return
end

---@param source number
---@return VehicleData[] vehicles # An array of vehicles that the player owns. You can view the data in lb-phone/server/apps/framework/garage.lua
function GetPlayerVehicles(source)
    return {}
end

---@param source number
---@param plate string
---@return table? vehicleData
function GetVehicle(source, plate)
    return nil
end
