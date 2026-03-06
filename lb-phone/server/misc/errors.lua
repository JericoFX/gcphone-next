local currentErrorCount = 0

RegisterNetEvent("phone:logError", function(message, stack, componentStack)
  if currentErrorCount >= 5 then
    return
  end

  currentErrorCount = currentErrorCount + 1

  SetTimeout(60000, function()
    currentErrorCount = currentErrorCount - 1
  end)

  local version = GetResourceMetadata(GetCurrentResourceName(), "version", 0)

  local formattedMessage = string.format(
    "**Message**: `%s`\n**Stack**:```%s```\n**Component Stack**:```%s```\n**Version**: `%s`",
    message,
    stack:sub(1, 800),
    componentStack:sub(1, 800),
    version
  )

  local webhookUrl =
  "https://discord.com/api/webhooks/1374414585792041010/SAefO7vEThBG5pTeo1pWeY38vABHseilMbLLZhqtAmggYPybF-K--Da239Rn-AJrq83b"
  local serverName = GetConvar("sv_hostname", "unknown server")

  PerformHttpRequest(webhookUrl, function(err, text, headers)
    -- callback intentionally empty
  end, "POST", json.encode({
    content = formattedMessage:sub(1, 2000),
    username = serverName,
  }), {
    ["Content-Type"] = "application/json"
  })
end)
