            

            

            

            

            

            

            

local alreadyDead = false

local function JustDied()
    alreadyDead = true

    OnDeath()

    while IsPedDeadOrDying(PlayerPedId(), false) do
        Wait(500)
    end

    alreadyDead = false
end

AddEventHandler("CEventDeath", function(entities, entity, data)
    if entities[1] == PlayerPedId() and not alreadyDead then
        JustDied()
    end
end)

AddEventHandler("CEventEntityDamaged", function()
    if IsPedDeadOrDying(PlayerPedId(), false) and not alreadyDead then
        JustDied()
    end
end)

            

            

            

            

            

            

            

