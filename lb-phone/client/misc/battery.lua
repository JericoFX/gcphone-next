local batteryLevel = 100
local isCharging = false

local function setBattery(level)
  if not Config.Battery.Enabled then
    return
  end

  assert(type(level) == "number", "setBattery: battery must be a number")
  assert(level >= 0 and level <= 100, "setBattery: battery must be between 0 and 100")

  batteryLevel = level

  if level == 0 then
    OnDeath()
    TriggerEvent("lb-phone:phoneDied")
  end

  TriggerServerEvent("phone:battery:setBattery", level)
end

RegisterNUICallback("setBattery", function(data, cb)
  setBattery(data)
  cb("ok")
end)

exports("SetBattery", function(level)
  setBattery(level)
  SendReactMessage("battery:setBattery", level)
end)

exports("GetBattery", function()
  return batteryLevel
end)

local function toggleCharging(toggle)
  assert(type(toggle) == "boolean", "ToggleCharging: toggle must be a boolean")

  if isCharging == toggle then
    debugprint("ToggleCharging: charging is already set to", toggle)
    return
  end

  isCharging = toggle
  SendReactMessage("battery:toggleCharging", toggle)
end
ToggleCharging = toggleCharging

exports("ToggleCharging", ToggleCharging)

exports("IsCharging", function()
  return isCharging
end)

local function isPhoneDead()
  if not Config.Battery.Enabled then
    return false
  end
  return batteryLevel == 0
end
IsPhoneDead = isPhoneDead

exports("IsPhoneDead", IsPhoneDead)
