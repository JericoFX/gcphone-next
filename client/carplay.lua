local PhoneState = require 'client.state'

local wasInVehicle = false

CreateThread(function()
    while true do
        local ped = PlayerPedId()
        local inVehicle = IsPedInAnyVehicle(ped, false)

        if inVehicle and not wasInVehicle then
            wasInVehicle = true
            SendNUIMessage({
                action = 'gcphone:carplay',
                data = { active = true }
            })
        elseif not inVehicle and wasInVehicle then
            wasInVehicle = false
            SendNUIMessage({
                action = 'gcphone:carplay',
                data = { active = false }
            })
        end

        Wait(1000)
    end
end)
