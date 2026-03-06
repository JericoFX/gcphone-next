-- Registra callback para aplicativos personalizados
RegisterNUICallback("CustomApp", function(data, callback)
    local appName = data.app
    local action = data.action
    callback("ok")

    if not action or not appName then
        debugprint("invalid data")
        return
    end

    local appConfig = Config.CustomApps[appName]

    if action == "open" then
        -- Verifica e executa callbacks do servidor
        if appConfig and appConfig.onServerUse then
            TriggerServerEvent("lb-phone:customApp", appName)
        end

        -- Fecha o telefone se o app não tiver UI e não for para manter aberto
        if appConfig and not appConfig.ui and not appConfig.keepOpen then
            debugprint("Closing phone due to custom app without ui")
            ToggleOpen(false)
        end

        -- Executa callbacks locais
        if appConfig and appConfig.onUse then
            Citizen.CreateThreadNow(function()
                appConfig.onUse()
            end)
        end

        if appConfig and appConfig.onOpen then
            Citizen.CreateThreadNow(function()
                appConfig.onOpen()
            end)
        end
    elseif action == "close" then
        if appConfig and appConfig.onClose then
            appConfig.onClose()
        end
    elseif action == "install" then
        if appConfig and appConfig.onInstall then
            appConfig.onInstall()
        end
    elseif action == "uninstall" then
        if appConfig and appConfig.onDelete then
            appConfig.onDelete()
        end
    end
end)

-- Tabelas para gerenciar popups e callbacks
local callbacks = {}
local validColors = {
    blue = true,
    red = true,
    green = true,
    yellow = true
}

-- Gera um ID único para callbacks
local function GenerateCallbackId()
    local id = math.random(999999999)
    while callbacks[id] do
        id = math.random(999999999)
    end
    return id
end

-- Callback para popups
RegisterNUICallback("PopUp", function(data, callback)
    if not callbacks[data] then return end

    callback("ok")
    callbacks[data]()
    callbacks[data] = nil
end)

-- Callback para mudanças em inputs de popups
RegisterNUICallback("PopUpInputChanged", function(data, callback)
    local id = data.id
    local value = data.value

    if not callbacks[id] then return end

    callback("ok")
    callbacks[id](value)
end)

-- Função para configurar popups
local function SetupPopup(popupData, isServer)
    -- Validações básicas
    assert(popupData.buttons and #popupData.buttons > 0, "You need at least one button")

    -- Configura os botões
    for _, button in pairs(popupData.buttons) do
        assert(button.title, "You need a title for each button")

        -- Define cor padrão se não especificada
        button.color = button.color or "blue"
        assert(validColors[button.color], "Invalid color")

        -- Configura callbacks
        if isServer == true then
            if button.cb then
                local callbackId = GenerateCallbackId()
                callbacks[callbackId] = function()
                    button.cb(button.callbackId)
                end
                button.cb = callbackId
            end
        else
            if button.callbackId then
                local callbackId = GenerateCallbackId()
                callbacks[callbackId] = function()
                    isServer(button.callbackId)
                end
                button.cb = callbackId
            end
        end
    end

    -- Configura input se existir
    if popupData.input and popupData.input.onChange then
        local callbackId = GenerateCallbackId()

        if isServer == true then
            callbacks[callbackId] = popupData.input.onChange
        else
            callbacks[callbackId] = function(value)
                SendReactMessage("customApp:sendMessage", {
                    identifier = "any",
                    message = {
                        type = "popUpInputChanged",
                        value = value
                    }
                })
            end
        end

        popupData.input.onChange = callbackId
    end

    -- Envia para a UI
    SendReactMessage("onComponentUse", {
        type = "popup",
        data = popupData
    })
end

-- Registra callback para popups
RegisterNUICallback("SetPopUp", SetupPopup)

-- Export para popups
exports("SetPopUp", function(popupData)
    SetupPopup(popupData, true)
end)

-- Callback para menu de contexto
RegisterNUICallback("ContextMenu", function(data, callback)
    if not callbacks[data] then return end

    callbacks[data]()
    callbacks[data] = nil
    callback("ok")
end)

-- Função para configurar menu de contexto
local function SetupContextMenu(menuData, isServer)
    -- Validações básicas
    assert(menuData.buttons and #menuData.buttons > 0, "You need at least one button")

    -- Configura os botões
    for _, button in pairs(menuData.buttons) do
        assert(button.title, "You need a title for each button")

        -- Define cor padrão se não especificada
        button.color = button.color or "blue"
        assert(validColors[button.color], "Invalid colour")

        -- Valida callbacks
        if isServer == true then
            assert(button.cb, "You need a callback for each button")
        else
            assert(button.callbackId, "You need a callback for each button")
        end

        -- Configura callbacks
        local callbackId = GenerateCallbackId()
        callbacks[callbackId] = function()
            if isServer == true then
                button.cb()
            else
                isServer(button.callbackId)
            end
        end
        button.cb = callbackId
    end

    -- Envia para a UI
    SendReactMessage("onComponentUse", {
        type = "contextmenu",
        data = menuData
    })
end

-- Registra callback para menu de contexto
RegisterNUICallback("SetContextMenu", SetupContextMenu)

-- Export para menu de contexto
exports("SetContextMenu", function(menuData)
    SetupContextMenu(menuData, true)
end)

-- Função para componente de câmera
local function SetupCameraComponent(cameraData, callbackFunc)
    -- Garante que cameraData é uma tabela
    if type(cameraData) ~= "table" or not cameraData then
        cameraData = {}
    end

    local wasPhoneOpen = phoneOpen
    local callbackId = GenerateCallbackId()
    cameraData.id = callbackId

    -- Abre o telefone se necessário
    if not wasPhoneOpen then
        debugprint("Opening phone due to camera component")
        ToggleOpen(true)
    end

    -- Configura promise se não houver callback
    local responsePromise
    if not callbackFunc then
        responsePromise = promise.new()
    end

    -- Configura callback
    callbacks[callbackId] = function(response)
        if callbackFunc then
            callbackFunc(response.url)
        else
            responsePromise:resolve(response.url)
        end

        -- Fecha o telefone se estava fechado antes
        if not wasPhoneOpen then
            debugprint("Closing phone due to camera component")
            ToggleOpen(false)
        end
    end

    -- Envia para a UI
    SendReactMessage("onComponentUse", {
        type = "camera",
        data = cameraData
    })

    -- Retorna promise se não houver callback
    if not callbackFunc then
        return Citizen.Await(responsePromise)
    end
end

-- Export para componente de câmera
exports("SetCameraComponent", SetupCameraComponent)

-- Função para modal de contato
local function SetupContactModal(contactData)
    assert(contactData, "You need to provide a phone number")
    SendReactMessage("onComponentUse", {
        type = "contactmodal",
        data = contactData
    })
end

-- Callback para modal de contato
RegisterNUICallback("SetContactModal", function(data, callback)
    SetupContactModal(data)
    callback("ok")
end)

-- Export para modal de contato
exports("SetContactModal", SetupContactModal)

-- Mapeamento de componentes e seus tipos de retorno
local componentReturnTypes = {
    gallery = { "image" },
    gif = { "gif" },
    emoji = { "emoji" },
    camera = { "url" },
    colorpicker = { "color" },
    contactselector = { "contact" }
}

-- Callback para uso de componentes
RegisterNUICallback("UsedComponent", function(data, callback)
    local id = data and data.id
    if not id or not callbacks[id] then return end

    callbacks[id](data)
    callbacks[id] = nil
    callback("ok")
end)

-- Função para mostrar componentes
local function ShowComponent(componentData, callbackFunc)
    local component = componentData.component
    assert(component, "You need to specify a component")
    assert(componentReturnTypes[component], "Invalid component")

    local callbackId = GenerateCallbackId()

    -- Configura callback
    callbacks[callbackId] = function(response)
        local returnValues = {}
        for _, returnType in ipairs(componentReturnTypes[component]) do
            returnValues[#returnValues + 1] = response[returnType]
        end

        callbackFunc(table.unpack(returnValues))
    end

    componentData.id = callbackId

    -- Envia para a UI
    SendReactMessage("onComponentUse", {
        type = component,
        data = componentData
    })
end

-- Callback para mostrar componentes
RegisterNUICallback("ShowComponent", ShowComponent)

-- Export para mostrar componentes
exports("ShowComponent", ShowComponent)

-- Callback para criar chamadas
RegisterNUICallback("CreateCall", function(data, callback)
    CreateCall(data)
    callback("ok")
end)

-- Callback para obter configurações
RegisterNUICallback("GetSettings", function(_, callback)
    callback(settings)
end)

-- Callback para obter localização
RegisterNUICallback("GetLocale", function(data, callback)
    callback(L(data.path, data.format))
end)

-- Callback para enviar notificações
RegisterNUICallback("SendNotification", function(data, callback)
    TriggerEvent("phone:sendNotification", data)
    callback(true)
end)
