local function handleYellowPagesRequest(data, callback)
  local action = data.action or ""
  debugprint("Pages: " .. action)

  if action == "getPosts" then
    local filters = { search = data.query }
    TriggerCallback("yellowPages:getPosts", callback, data.page, filters)
  elseif action == "sendPost" then
    TriggerCallback("yellowPages:createPost", callback, data.data)
  elseif action == "deletePost" then
    TriggerCallback("yellowPages:deletePost", callback, data.id)
  end
end

RegisterNUICallback("YellowPages", handleYellowPagesRequest)

local function onNewYellowPagesPost(postData)
  TriggerEvent("lb-phone:pages:newPost", postData)
  SendReactMessage("yellowPages:newPost", postData)
end

RegisterNetEvent("phone:yellowPages:newPost", onNewYellowPagesPost)
