---Hide hud components, used in the camera app
function HideHudComponents()
    HideHudAndRadarThisFrame()
    HideHelpTextThisFrame()
end

---@param entity number
---@return boolean success
function TakeControlOfEntity(entity)
    if NetworkHasControlOfEntity(entity) then
        return true
    end

    local timer = GetGameTimer() + 5000

    while not NetworkHasControlOfEntity(entity) and timer > GetGameTimer() do
        NetworkRequestControlOfEntity(entity)
        Wait(0)
    end

    return NetworkHasControlOfEntity(entity)
end

---Request a model and wait for it to load
---@param model number|string
---@return number model
function LoadModel(model)
    model = type(model) == "number" and model or joaat(model)

    RequestModel(model)

    while not HasModelLoaded(model) do
        Wait(0)
    end

    return model
end

---Wait for network id & entity to exist
---@param netId number
---@return number? entity The entity, or nil if it doesn't exist
function WaitForNetworkId(netId)
    local timer = GetGameTimer() + 5000

    while not NetworkDoesNetworkIdExist(netId) do
        Wait(0)

        if GetGameTimer() > timer then
            return
        end
    end

    timer = GetGameTimer() + 5000

    while not DoesEntityExist(NetworkGetEntityFromNetworkId(netId)) do
        Wait(0)

        if GetGameTimer() > timer then
            return
        end
    end

    return NetworkGetEntityFromNetworkId(netId)
end

function DrawFlashlight(ped)
    local coords = GetPedBoneCoords(ped, 28422, 0.5, 0.0, 0.0)
    local forward = GetEntityForwardVector(ped)

    DrawSpotLightWithShadow(
        coords.x, coords.y, coords.z,
        forward.x, forward.y, forward.z,
        255, 255, 255, -- r, g, b
        15.0,          -- distance
        3.0,           -- brightness
        0.0,           -- roundness
        50.0,          -- radius
        100.0,         -- falloff
        1              -- shadowId
    )

    DrawSpotLightWithShadow(
        coords.x, coords.y, coords.z,
        forward.x, forward.y, forward.z,
        255, 255, 255, -- r, g, b
        30.0,          -- distance
        10.0,          -- brightness
        0.0,           -- roundness
        20.0,          -- radius
        25.0,          -- falloff
        1              -- shadowId
    )
end

local lastInteraction = 0

function CanInteract()
    if lastInteraction + 500 > GetGameTimer() then
        return false
    end

    lastInteraction = GetGameTimer()

    return true
end

function ReloadPhone()
    local wasOpen = phoneOpen

    debugprint("ReloadPhone triggered")

    LogOut()
    Wait(1000)
    FetchPhone()

    if wasOpen then
        ToggleOpen(true)
    end
end

exports("ReloadPhone", ReloadPhone)

---@param appIdentifier string
---@param jobName? string
---@param jobGrade? number
function HasAccessToApp(appIdentifier, jobName, jobGrade)
    if not GetJob then
        debugprint("GetJob is not defined in framework functions")
        return true
    end

    if not GetJobGrade then
        debugprint("GetJobGrade is not defined in framework functions")
        return true
    end

    if not Config.WhitelistApps and not Config.BlacklistApps then
        return true
    end

    jobName = jobName or GetJob()
    jobGrade = jobGrade or GetJobGrade()

    local blacklistedJobs = Config.BlacklistApps and Config.BlacklistApps[appIdentifier]

    if blacklistedJobs then
        if table.type(blacklistedJobs) == "array" then
            if table.contains(blacklistedJobs, jobName) then
                debugprint("Player's job is blacklisted from app", appIdentifier)
                return false
            end
        else
            if blacklistedJobs[jobName] and jobGrade >= blacklistedJobs[jobName] then
                debugprint("Player's job is blacklisted from app", appIdentifier)
                return false
            end
        end
    end

    local allowedJobs = Config.WhitelistApps and Config.WhitelistApps[appIdentifier]

    if allowedJobs then
        if table.type(allowedJobs) == "array" then
            if table.contains(allowedJobs, jobName) then
                return true
            end

            debugprint("Player is not whitelisted for app", appIdentifier)
            return false
        else
            if allowedJobs[jobName] and jobGrade >= allowedJobs[jobName] then
                return true
            end

            debugprint("Player is not whitelisted for app", appIdentifier)
            return false
        end
    end

    return true
end

---@param vehicle number
---@param plate string
function GiveVehicleKey(vehicle, plate)
    TriggerEvent("vehiclekeys:client:SetOwner", plate)
end

-- ---@param uploadType "Video" | "Image" | "Audio"
-- ---@return UploadMethod?
-- function CustomGetUploadMethod(uploadType)
--     local methods = UploadMethods[Config.UploadMethod[uploadType]]

--     if not methods then
--         infoprint("error", "Upload methods not found for ", uploadType)
--         return
--     end

--     ---@type UploadMethod?
--     local method = methods[uploadType] or methods.Default

--     if not method then
--         infoprint("error", "Upload method not found for ", uploadType)
--         return
--     end

--     return method
-- end
