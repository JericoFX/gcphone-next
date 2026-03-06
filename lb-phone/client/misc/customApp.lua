local registerExport, invokingResource, functionHandler

-- Função para formatar dados da app customizada para UI
local function FormatCustomAppDataForUI(appData)
  local formattedData = {}

  formattedData.identifier = appData.identifier
  formattedData.resourceName = appData.resourceName
  formattedData.custom = true
  formattedData.name = appData.name
  formattedData.icon = appData.icon
  formattedData.description = appData.description
  formattedData.images = appData.images
  formattedData.developer = appData.developer
  formattedData.size = appData.size or 42000
  formattedData.price = appData.price
  formattedData.game = appData.game
  formattedData.landscape = appData.landscape or false
  formattedData.removable = not appData.defaultApp
  formattedData.defaultApp = appData.defaultApp
  formattedData.disableInAppNotifications = appData.disableInAppNotifications
  formattedData.ui = appData.ui
  formattedData.fixBlur = appData.fixBlur
  formattedData.onOpen = appData.onOpen
  formattedData.onClose = appData.onClose
  formattedData.onUse = appData.onUse
  formattedData.onDelete = appData.onDelete
  formattedData.onInstall = appData.onInstall
  formattedData.access = HasAccessToApp(appData.identifier)

  return formattedData
end

FormatCustomAppDataForUI = FormatCustomAppDataForUI

-- Export: Enviar mensagem para app customizada
registerExport = exports
functionHandler = "SendCustomAppMessage"
function sendCustomAppMessage(identifier, message)
  local currentResource = GetInvokingResource()
  if not identifier then
    return false, "No identifier provided"
  end

  local app = Config.CustomApps[identifier]
  if not app then
    return false, "App does not exist"
  end

  if app.resourceName ~= currentResource then
    return false, "App was not created by " .. currentResource
  end

  SendReactMessage("customApp:sendMessage", {
    identifier = identifier,
    message = message
  })

  return true
end

registerExport(functionHandler, sendCustomAppMessage)

-- Export: Adicionar app customizada
function addCustomApp(appData)
  local currentResource = GetInvokingResource()

  if not appData or not appData.identifier then
    return false, "No identifier provided"
  end
  if not appData.name then
    return false, "No name provided"
  end
  if not appData.description then
    return false, "No description provided"
  end

  if Config.CustomApps[appData.identifier] then
    return false, "App already exists"
  end

  Config.CustomApps[appData.identifier] = {
    identifier = appData.identifier,
    resourceName = currentResource,
    custom = true,
    name = appData.name,
    icon = appData.icon,
    description = appData.description,
    images = appData.images,
    developer = appData.developer,
    size = appData.size or 42000,
    price = appData.price,
    game = appData.game,
    landscape = appData.landscape or false,
    removable = not appData.defaultApp,
    defaultApp = appData.defaultApp,
    disableInAppNotifications = appData.disableInAppNotifications,
    ui = appData.ui,
    fixBlur = appData.fixBlur,
    onOpen = appData.onOpen,
    onClose = appData.onClose,
    onUse = appData.onUse,
    onDelete = appData.onDelete,
    onInstall = appData.onInstall,
  }

  debugprint("adding custom app", appData.identifier)
  SendReactMessage("addCustomApp", FormatCustomAppDataForUI(Config.CustomApps[appData.identifier]))

  return true
end

registerExport("AddCustomApp", addCustomApp)

-- Export: Remover app customizada
function removeCustomApp(identifier)
  local currentResource = GetInvokingResource()

  if not identifier then
    return false, "No identifier provided"
  end

  local app = Config.CustomApps[identifier]
  if not app then
    return false, "App does not exist"
  end

  if app.resourceName ~= currentResource then
    return false, "App was not created by " .. currentResource
  end

  Config.CustomApps[identifier] = nil
  SendReactMessage("removeCustomApp", identifier)

  return true
end

registerExport("RemoveCustomApp", removeCustomApp)

-- Evento: remover apps quando o recurso para
AddEventHandler("onResourceStop", function(resourceName)
  for appId, app in pairs(Config.CustomApps) do
    if app.resourceName == resourceName then
      Config.CustomApps[appId] = nil
      SendReactMessage("removeCustomApp", appId)
      debugprint("Removed app " .. appId .. " due to resource stopping")
    end
  end
end)
