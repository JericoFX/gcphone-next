local autoDeleteHours = Config.AutoDeleteNotifications
if not autoDeleteHours then
  return
end

if type(autoDeleteHours) ~= "number" then
  Config.AutoDeleteNotifications = 168
  autoDeleteHours = 168
end

Wait(5000)

while true do
  debugprint("Deleting all old notifications..")

  local startTime = os.nanotime()

  MySQL.update(
    "DELETE FROM phone_notifications WHERE `timestamp` < DATE_SUB(NOW(), INTERVAL ? HOUR)",
    { autoDeleteHours },
    function(deletedCount)
      local endTime = os.nanotime()
      local elapsedMs = (endTime - startTime) / 1000000.0

      local plural = (deletedCount == 1) and "" or "s"
      debugprint("Deleted " .. deletedCount .. " notification" .. plural .. " in " .. elapsedMs .. " ms")
    end
  )

  Wait(3600000) -- espera 1 hora antes da próxima execução
end
