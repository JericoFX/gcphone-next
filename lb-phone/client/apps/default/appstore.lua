-- Registra o callback para a App Store
RegisterNUICallback("AppStore", function(data, callback)
    -- Verifica se há um telefone ativo
    if not currentPhone then
        return
    end

    local action = data.action

    -- Log para depuração
    debugprint("AppStore:" .. (action or ""))

    -- Verifica a ação solicitada
    if action == "buyApp" then
        -- Chama o callback para comprar o aplicativo
        TriggerCallback("appstore:buyApp", callback, data.price)
    end
end)
