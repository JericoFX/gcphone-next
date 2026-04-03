-- Server entry point: requires all modules in dependency order.
-- JS files and @oxmysql are loaded via fxmanifest before this file.
-- Config and ox_lib are loaded via shared_scripts.

-- ── Startup checks ──

if GetResourceState('yarn') == 'started' then
    print('^1[gcphone] FATAL: The "yarn" resource is running.^0')
    print('^1[gcphone] FiveM yarn auto-detects package.json and breaks gcphone dependencies.^0')
    print('^1[gcphone] Stop yarn first: "stop yarn" in server console, then "ensure gcphone".^0')
    print('^1[gcphone] To prevent this permanently, remove "ensure yarn" from your server.cfg.^0')
    return
end

local resourcePath = GetResourcePath(cache.resource)
local nodeModules = resourcePath .. '/node_modules'
if not LoadResourceFile(cache.resource, 'node_modules/livekit-server-sdk/package.json') then
    print('^3[gcphone] WARNING: node_modules not installed or livekit-server-sdk missing.^0')
    print('^3[gcphone] Run: cd ' .. resourcePath .. ' && npm install^0')
    print('^3[gcphone] LiveKit features (calls, SnapLive) will not work without it.^0')
end

require 'server.modules.database'
require 'server.main'
require 'server.modules.hooks'
require 'server.modules.phone'
require 'server.modules.contacts'
require 'server.modules.security'
require 'server.modules._utils'
require 'server.modules.notifications'
require 'server.modules.messages'
require 'server.modules.mail'
require 'server.modules.calls'
require 'server.modules.flashlight'
require 'server.modules.nearby_voice'
require 'server.modules.gallery'
require 'server.modules.bank'
require 'server.modules.wallet'
require 'server.modules.documents'
require 'server.modules.documents_fix'
require 'server.modules.chirp'
require 'server.modules.snap'
require 'server.modules.social'
require 'server.modules.garage'
require 'server.modules.yellowpages'
require 'server.modules.matchmylove'
require 'server.modules.services'
require 'server.modules.news'
require 'server.modules.clips'
require 'server.modules.live'
require 'server.modules.proximity'
require 'server.modules.external'
require 'server.modules.storage'
require 'server.modules.livekit'
require 'server.modules.location_tracking'
require 'server.modules.phone_drop'
require 'server.modules.music'
require 'server.modules.notes'
require 'server.modules.retention'
require 'server.modules.darkrooms'
require 'server.modules.radio'
require 'server.modules.cityride'
require 'server.modules.sdk'
