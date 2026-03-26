local PhoneState = require 'client.state'

local wasInVehicle = false

CreateThread(function()
    while true do
        local ped = PlayerPedId()
        local inVehicle = IsPedInAnyVehicle(ped, false)

        if inVehicle and not wasInVehicle then
            wasInVehicle = true
            SendNUIMessage({
                type = 'gcphone:carplay',
                payload = { active = true }
            })
        elseif not inVehicle and wasInVehicle then
            wasInVehicle = false
            SendNUIMessage({
                type = 'gcphone:carplay',
                payload = { active = false }
            })
        end

        Wait(1000)
    end
end)
