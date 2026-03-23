-- Bridge orchestrator: detects framework and returns the appropriate bridge module.

local bridgeModule

if Config.Framework == 'qbcore' or Config.Framework == 'qbox' then
    bridgeModule = require 'server.bridge.qbcore'
elseif Config.Framework == 'esx' then
    bridgeModule = require 'server.bridge.esx'
end

if not bridgeModule then
    error('[gcphone-next] No supported framework detected. Set Config.Framework to "qbcore", "qbox", or "esx".')
end

return bridgeModule
