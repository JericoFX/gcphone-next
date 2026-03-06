-- Registra o evento para aplicativos personalizados
RegisterNetEvent("lb-phone:customApp", function(appName)
  local playerSrc = source

  -- Verifica se o aplicativo existe na configuração
  local appConfig = Config.CustomApps[appName]

  -- Se existir e tiver uma função de uso no servidor, executa
  if appConfig and appConfig.onServerUse then
    appConfig.onServerUse(playerSrc)
  end
end)
