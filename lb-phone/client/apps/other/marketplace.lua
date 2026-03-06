local registerNUICallback = RegisterNUICallback
local registerNetEvent = RegisterNetEvent

local function handleMarketPlaceRequest(data, callback)
  local action = data.action or ""
  debugprint("MarketPlace: " .. action)

  if action == "getPosts" then
    local posts = AwaitCallback("marketplace:getPosts", data)
    for i = 1, #posts do
      posts[i].attachments = json.decode(posts[i].attachments)
    end
    callback(posts)
  elseif action == "sendPost" then
    TriggerCallback("marketplace:createPost", callback, data.data)
  elseif action == "deletePost" then
    TriggerCallback("marketplace:deletePost", callback, data.id)
  end
end

registerNUICallback("MarketPlace", handleMarketPlaceRequest)

local function onNewMarketPlacePost(post)
  TriggerEvent("lb-phone:marketplace:newPost", post)
  SendReactMessage("marketPlace:newPost", post)
end

registerNetEvent("phone:marketplace:newPost", onNewMarketPlacePost)
