fx_version "cerulean"
game "gta5"
lua54 "yes"

version "2.3.1"

shared_script {
    "config/*.lua",
    "shared/**/*.lua"
}

client_script {
    "lib/client/**.lua",
    "client/**.lua"
}

server_scripts {
    "@oxmysql/lib/MySQL.lua",
    "lib/server/**.lua",
    "server/**/*.lua",
}

files {
    "ui/dist/**/*",
    "ui/components.js",
    "config/**/*"
}

ui_page "ui/dist/index.html"

dependency "oxmysql"
