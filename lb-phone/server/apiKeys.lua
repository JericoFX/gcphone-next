-- Webhook for instapic posts, recommended to be a public channel
INSTAPIC_WEBHOOK = "https://discord.com/api/webhooks/"
-- Webhook for birdy posts, recommended to be a public channel
BIRDY_WEBHOOK = "https://discord.com/api/webhooks/"

-- Discord webhook for server logs
LOGS = {
    Default = "https://discord.com/api/webhooks/", -- set to false to disable
    Calls = "https://discord.com/api/webhooks/",
    Messages = "https://discord.com/api/webhooks/",
    InstaPic = "https://discord.com/api/webhooks/",
    Birdy = "https://discord.com/api/webhooks/",
    YellowPages = "https://discord.com/api/webhooks/",
    Marketplace = "https://discord.com/api/webhooks/",
    Mail = "https://discord.com/api/webhooks/",
    Wallet = "https://discord.com/api/webhooks/",
    DarkChat = "https://discord.com/api/webhooks/",
    Services = "https://discord.com/api/webhooks/",
    Crypto = "https://discord.com/api/webhooks/",
    Trendy = "https://discord.com/api/webhooks/",
    Uploads = "https://discord.com/api/webhooks/" -- all camera uploads will go here
}

DISCORD_TOKEN = nil -- you can set a discord bot token here to get the players discord avatar for logs

-- Set your API keys for uploading media here.
-- Please note that the API key needs to match the correct upload method defined in Config.UploadMethod.
-- The default upload method is Fivemanage
-- We STRONGLY discourage using Discord as an upload method, as uploaded files may become inaccessible after a while.
-- You can get your API keys from https://fivemanage.com/
-- A video tutorial for how to set up Fivemanage can be found here: https://www.youtube.com/watch?v=y3bCaHS6Moc
API_KEYS = {
    Video = "93v2SL68TwP1nuXtVvWqsLZ3YaJW4mnz",
    Image = "93v2SL68TwP1nuXtVvWqsLZ3YaJW4mnz",
    Audio = "93v2SL68TwP1nuXtVvWqsLZ3YaJW4mnz",
}

WEBRTC = {
    -- You can get your credentials from https://dash.cloudflare.com/?to=/:account/realtime/turn/overview
    TokenID = nil,
    APIToken = nil,
}
