local BaseCallback = BaseCallback

-- Get all alarms for a phone number
BaseCallback("clock:getAlarms", function(source, phoneNumber)
    return MySQL.query.await("SELECT id, hours, minutes, label, enabled FROM phone_clock_alarms WHERE phone_number = ?",
        { phoneNumber })
end, {})

-- Create a new alarm
BaseCallback("clock:createAlarm", function(source, phoneNumber, label, hours, minutes)
    return MySQL.insert.await(
        "INSERT INTO phone_clock_alarms (phone_number, hours, minutes, label) VALUES (@phoneNumber, @hours, @minutes, @label)",
        {
            ["@phoneNumber"] = phoneNumber,
            ["@hours"] = hours,
            ["@minutes"] = minutes,
            ["@label"] = label
        }
    )
end)

-- Delete an alarm
BaseCallback("clock:deleteAlarm", function(source, phoneNumber, alarmId)
    local affectedRows = MySQL.update.await(
        "DELETE FROM phone_clock_alarms WHERE id = ? AND phone_number = ?",
        { alarmId, phoneNumber }
    )
    return affectedRows > 0
end)

-- Toggle alarm status
BaseCallback("clock:toggleAlarm", function(source, phoneNumber, alarmId, enabled)
    MySQL.update.await(
        "UPDATE phone_clock_alarms SET enabled = ? WHERE id = ? AND phone_number = ?",
        { enabled == true, alarmId, phoneNumber }
    )
    return enabled
end)

-- Update an existing alarm
BaseCallback("clock:updateAlarm", function(source, phoneNumber, alarmId, label, hours, minutes)
    local affectedRows = MySQL.update.await(
        "UPDATE phone_clock_alarms SET label = ?, hours = ?, minutes = ? WHERE id = ? AND phone_number = ?",
        { label, hours, minutes, alarmId, phoneNumber }
    )
    return affectedRows > 0
end)
