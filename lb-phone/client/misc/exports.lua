local exportsFunc, exportName, exportFunc

-- Export para alternar indicador Home (barra superior)
exportsFunc = exports
exportName = "ToggleHomeIndicator"
exportFunc = function(state)
  SendReactMessage("toggleShowHomeIndicator", state)
end
exportsFunc(exportName, exportFunc)

-- Export para alternar modo paisagem
exportsFunc = exports
exportName = "ToggleLandscape"
exportFunc = function(state)
  SendReactMessage("toggleLandscape", state)
end
exportsFunc(exportName, exportFunc)

-- Export para abrir um app com nome e metadados opcionais
exportsFunc = exports
exportName = "OpenApp"
exportFunc = function(appName, metadata)
  SendReactMessage("setApp", {
    name = appName,
    metadata = metadata
  })
end
exportsFunc(exportName, exportFunc)

-- Export para fechar um app, com opção de fechar completamente
exportsFunc = exports
exportName = "CloseApp"
exportFunc = function(params)
  params = params or {}

  local appName = params.app or "nil"
  local closeCompletely = params.closeCompletely == true

  debugprint("CloseApp: " .. appName .. ", closeCompletely: " .. tostring(closeCompletely))

  SendReactMessage("closeApp", {
    app = params.app,
    closeCompletely = closeCompletely
  })
end
exportsFunc(exportName, exportFunc)
