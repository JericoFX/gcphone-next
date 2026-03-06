RegisterNUICallback("Clock", function(data, callback)
  local action = data.action
  debugprint("Clock:" .. (action or ""))

  if action == "getAlarms" then
    TriggerCallback("clock:getAlarms", callback)
  elseif action == "createAlarm" then
    TriggerCallback(
      "clock:createAlarm",
      callback,
      data.label,
      data.hours,
      data.minutes
    )
  elseif action == "deleteAlarm" then
    TriggerCallback(
      "clock:deleteAlarm",
      callback,
      data.id
    )
  elseif action == "toggleAlarm" then
    TriggerCallback(
      "clock:toggleAlarm",
      callback,
      data.id,
      data.enabled
    )
  elseif action == "updateAlarm" then
    TriggerCallback(
      "clock:updateAlarm",
      callback,
      data.id,
      data.label,
      data.hours,
      data.minutes
    )
  end
end)
