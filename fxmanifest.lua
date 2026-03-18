fx_version 'cerulean'
game 'gta5'

author 'gcphone-next'
description 'Modern FiveM Phone - SolidJS + ox_lib + oxmysql'
version '2.0.0'

lua54 'yes'

ui_page 'web/dist/index.html'

files {
    'web/dist/**/*',
    'web/dist/index.html',
    
    'shared/config.lua',
    'shared/locales/*.json',
}

shared_scripts {
    '@ox_lib/init.lua',
    'shared/locale.lua',
    'shared/config.lua',
}

client_scripts {
    'client/main.lua',
    'client/phone_animation.lua',
    'client/phone.lua',
    'client/nui_bridge.lua',
    'client/native_audio.lua',
    'client/flashlight.lua',
    'client/camera_walk.lua',
    'client/camera.lua',
    'client/calls.lua',
    'client/nearby_voice.lua',
    'client/proximity.lua',
    'client/location_tracking.lua',
    'client/phone_drop.lua',
    'client/music.lua',
}

server_scripts {
    'server/js/livekit.js',
    'server/js/socket_auth.js',
    '@oxmysql/lib/MySQL.lua',
    'server/modules/database.lua',
    'server/main.lua',
    'server/modules/hooks.lua',
    'server/bridge/qbcore.lua',
    'server/bridge/esx.lua',
    'server/modules/phone.lua',
    'server/modules/contacts.lua',
    'server/modules/security.lua',
    'server/modules/_utils.lua',
    'server/modules/notifications.lua',
    'server/modules/messages.lua',
    'server/modules/mail.lua',
    'server/modules/calls.lua',
    'server/modules/flashlight.lua',
    'server/modules/nearby_voice.lua',
    'server/modules/gallery.lua',
    'server/modules/bank.lua',
    'server/modules/wallet.lua',
    'server/modules/documents.lua',
    'server/modules/documents_fix.lua',
    'server/modules/chirp.lua',
    'server/modules/snap.lua',
    'server/modules/social.lua',
    'server/modules/garage.lua',
    'server/modules/market.lua',
    'server/modules/yellowpages.lua',
    'server/modules/news.lua',
    'server/modules/clips.lua',
    'server/modules/live.lua',
    'server/modules/proximity.lua',
    'server/modules/external.lua',
    'server/modules/storage.lua',
    'server/modules/livekit.lua',
    'server/modules/socket.lua',
    'server/modules/location_tracking.lua',
    'server/modules/phone_drop.lua',
    'server/modules/music.lua',
    'server/modules/retention.lua',
    'server/modules/darkrooms.lua',
}

dependencies {
    '/server:5181',
    '/onesync',
    'ox_lib',
    'oxmysql',
    'gcphone_sounds',
}
