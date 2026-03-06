local resourceName = GetCurrentResourceName()
local version = GetResourceMetadata(resourceName, "version", 0) or "0.0.0"
local uiPage = GetResourceMetadata(resourceName, "ui_page", 0)
local isUiPageCustom = uiPage ~= "ui/dist/index.html"

local allowedVideoExtensions = { "webm", "mp4", "mov" }
local maxEventsBeforeSend = 25

local eventsQueue = {}
local eventCount = 0
local cachedServerId = nil

-- Valida se o version está no formato correto
if not version:match("^%d+%.%d+%.%d+$") then
  version = "0.0.0"
end

local function sendTrackingData(force)
  if force == nil and eventCount < maxEventsBeforeSend then
    return
  end

  if not cachedServerId then
    local baseUrl = GetConvar("web_baseUrl", "")
    if baseUrl == "" then
      return
    end

    local reversedBaseUrl = baseUrl:reverse()
    local separatorIndex = reversedBaseUrl:find("-") or (#baseUrl + 1)
    local startIndex = #baseUrl - separatorIndex + 1
    cachedServerId = baseUrl:sub(startIndex + 1, #baseUrl - #".users.cfx.re")
  end

  local payload = json.encode({
    serverId = cachedServerId,
    version = version,
    events = eventsQueue
  })

  eventCount = 0
  eventsQueue = {}

  PerformHttpRequest(
    "https://track.lbscripts.com/",
    function() end,
    "POST",
    payload,
    { ["Content-Type"] = "application/json" }
  )
end

function TrackSimpleEvent(eventName)
  if isUiPageCustom then return end
  eventCount = eventCount + 1
  eventsQueue[eventCount] = { event = eventName }
  sendTrackingData()
end

function TrackSocialMediaPost(appName, mediaFiles)
  if isUiPageCustom then return end

  local videoCount = 0
  local photoCount = 0

  if mediaFiles then
    for _, file in ipairs(mediaFiles) do
      local ext = file:match("%.([^.]+)$") or "webp"
      if table.contains(allowedVideoExtensions, ext) then
        videoCount = videoCount + 1
      else
        photoCount = photoCount + 1
      end
    end
  end

  eventCount = eventCount + 1
  eventsQueue[eventCount] = {
    event = "social_media_post",
    app = appName,
    amountVideos = videoCount,
    amountPhotos = photoCount
  }

  sendTrackingData()
end

AddEventHandler("txAdmin:events:scheduledRestart", function(data)
  if data.secondsRemaining == 60 then
    sendTrackingData(true)
  end
end)

AddEventHandler("txAdmin:events:serverShuttingDown", function()
  sendTrackingData(true)
end)

AddEventHandler("onResourceStop", function(resourceNameStopped)
  if resourceNameStopped == resourceName then
    sendTrackingData(true)
  end
end)
