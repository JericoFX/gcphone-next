fx_version 'cerulean'
game 'gta5'

author 'JericoFX'
description 'Modern FiveM Phone - SolidJS + ox_lib + oxmysql'
version '3.1.11'

lua54 'yes'
node_version '22'

ui_page 'web/dist/index.html'

files {
    'web/dist/**/*',
    'web/dist/index.html',
    'version.txt',

    'sql/schema.sql',
    'sql/upgrades/*.sql',

    'shared/config.lua',
    'shared/locales/*.json',

    -- Client modules (required by lib.require on client side)
    'client/state.lua',
    'client/main.lua',
    'client/phone_animation.lua',
    'client/phone.lua',
    'client/nui_bridge.lua',
    'client/nui/events.lua',
    'client/nui/darkrooms.lua',
    'client/nui/radio.lua',
    'client/nui/cityride.lua',
    'client/native_audio.lua',
    'client/flashlight.lua',
    'client/camera_walk.lua',
    'client/camera.lua',
    'client/calls.lua',
    'client/nearby_voice.lua',
    'client/proximity.lua',
    'client/location_tracking.lua',
    'client/phone_drop.lua',
    'client/sdk.lua',
    'client/carplay.lua',
    'client/music.lua',
    'client/txadmin.lua',
    'client/garage.lua',
    'client/cityride.lua',
    'client/mugshot.lua',
}

shared_scripts {
    '@ox_lib/init.lua',
    'shared/locale.lua',
    'shared/config.lua',
}

client_scripts {
    'client/init.lua',
}

server_scripts {
    'server/js/youtube_search.js',
    '@oxmysql/lib/MySQL.lua',
    'server/init.lua',
    'server/modules/wavechat_dm.lua',
    'server/modules/webrtc.lua',
}

dependencies {
    '/server:5181',
    '/onesync',
    'ox_lib',
    'oxmysql',
    'gcphone_sounds',
}
