local batteryLevels = {}

RegisterNetEvent("phone:battery:setBattery", function(battery)
  local playerId = source
  if Config.Battery.Enabled then
    if type(battery) ~= "number" or battery < 0 or battery > 100 then
      debugprint("setBattery: invalid battery")
      return
    end
  end

  local phoneNumber = GetEquippedPhoneNumber(playerId)
  if not phoneNumber then
    return
  end

  batteryLevels[phoneNumber] = battery
end)

function IsPhoneDead(phoneNumber)
  if not Config.Battery.Enabled then
    return false
  end
  -- Return true if battery level is exactly 0 or nil
  return batteryLevels[phoneNumber] == 0
end

exports("IsPhoneDead", IsPhoneDead)

function SaveBattery(playerId)
  local phoneNumber = GetEquippedPhoneNumber(playerId)
  if not phoneNumber or not batteryLevels[phoneNumber] then
    return
  end

  debugprint(string.format("saving battery level (%s) for %s", batteryLevels[phoneNumber], phoneNumber))

  MySQL.update(
    "UPDATE phone_phones SET battery = ? WHERE phone_number = ?",
    { batteryLevels[phoneNumber], phoneNumber },
    function()
      batteryLevels[phoneNumber] = nil
    end
  )
end

exports("SaveBattery", SaveBattery)

function SaveAllBatteries()
  debugprint("saving all battery levels")
  local players = GetPlayers()
  for _, playerId in ipairs(players) do
    SaveBattery(playerId)
  end
end

exports("SaveAllBatteries", SaveAllBatteries)

AddEventHandler("playerDropped", function()
  SaveBattery(source)
end)

AddEventHandler("txAdmin:events:scheduledRestart", function(eventData)
  if eventData.secondsRemaining == 60 then
    SaveAllBatteries()
  end
end)

AddEventHandler("txAdmin:events:serverShuttingDown", SaveAllBatteries)

AddEventHandler("onResourceStop", function(resourceName)
  if resourceName == GetCurrentResourceName() then
    SaveAllBatteries()
  end
end)
