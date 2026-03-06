local Config = {}

Config.Debug = false
Config.DatabaseChecker = {
  Enabled = true,
  AutoFix = true
}

Config.Framework = "auto"
Config.CustomFramework = false
Config.QBMailEvent = true
Config.QBOldJobMethod = false

Config.Item = {
  Require = true,
  Name = "phone",
  Unique = false,
  Inventory = "auto"
}

Config.ServerSideSpawn = false
Config.PhoneModel = 108397254
Config.PhoneRotation = vector3(0.0, 0.0, 180.0)
Config.PhoneOffset = vector3(0.0, -0.005, 0.0)

Config.DynamicIsland = true
Config.SetupScreen = true
Config.AutoDeleteNotifications = false
Config.MaxNotifications = 100

Config.DisabledNotifications = {}
Config.WhitelistApps = {}
Config.BlacklistApps = {}

Config.ChangePassword = {
  Trendy = true,
  InstaPic = true,
  Birdy = true,
  DarkChat = true,
  Mail = true
}

Config.DeleteAccount = {
  Trendy = false,
  InstaPic = false,
  Birdy = false,
  DarkChat = false,
  Mail = false,
  Spark = false
}

Config.Companies = {
  Enabled = true,
  MessageOffline = true,
  DefaultCallsDisabled = false,
  AllowAnonymous = false,
  SeeEmployees = "everyone",
  DeleteConversations = true,
  Services = {},
  Contacts = {},
  Management = {
    Enabled = true,
    Duty = true,
    Deposit = true,
    Withdraw = true,
    Hire = true,
    Fire = true,
    Promote = true
  }
}

Config.CustomApps = {}

Config.Valet = {
  Enabled = true,
  Price = 100,
  Model = 1142162924,
  Drive = true,
  DisableDamages = false,
  FixTakeOut = false
}

Config.HouseScript = "auto"

Config.Voice = {
  CallEffects = false,
  System = "auto",
  HearNearby = true,
  RecordNearby = true
}

Config.Locations = {}

-- Locales list omitted here for brevity but should be added similarly --

Config.DefaultLocale = "en"
Config.DateLocale = "en-US"
Config.FrameColor = "#39334d"
Config.AllowFrameColorChange = true

Config.PhoneNumber = {
  Format = "({3}) {3}-{4}",
  Length = 7,
  Prefixes = { "205", "907", "480", "520", "602" }
}

Config.Battery = {
  Enabled = false,
  ChargeInterval = { 5, 10 },
  DischargeInterval = { 50, 60 },
  DischargeWhenInactiveInterval = { 80, 120 },
  DischargeWhenInactive = true
}

Config.CurrencyFormat = "$%s"
Config.MaxTransferAmount = 1000000
Config.TransferLimits = {
  Daily = false,
  Weekly = false
}

Config.EnableMessagePay = true
Config.EnableVoiceMessages = true

Config.CityName = "Los Santos"
Config.RealTime = true
Config.CustomTime = false

Config.EmailDomain = "lbphone.com"
Config.AutoCreateEmail = false
Config.DeleteMail = true
Config.DeleteMessages = true
Config.SyncFlash = true
Config.EndLiveClose = false

Config.AllowExternal = {
  Gallery = false,
  Birdy = false,
  InstaPic = false,
  Tinder = false,
  Trendy = false,
  Pages = false,
  MarketPlace = false,
  Mail = false,
  Messages = false,
  Other = false
}

Config.ExternalBlacklistedDomains = {
  "imgur.com",
  "discord.com",
  "discordapp.com"
}

Config.ExternalWhitelistedDomains = {}
Config.UploadWhitelistedDomains = {}

Config.WordBlacklist = {
  Enabled = false,
  Apps = {
    Birdy = true,
    InstaPic = true,
    Trendy = true,
    Spark = true,
    Messages = true,
    Pages = true,
    MarketPlace = true,
    DarkChat = true,
    Mail = true,
    Other = true
  },
  Words = {}
}

Config.AutoFollow = {
  Enabled = false,
  Birdy = { Enabled = true, Accounts = {} },
  InstaPic = { Enabled = true, Accounts = {} },
  Trendy = { Enabled = true, Accounts = {} }
}

Config.AutoBackup = true

Config.Post = {
  Birdy = true,
  InstaPic = true,
  Accounts = {
    Birdy = {
      Username = "Birdy",
      Avatar = "https://loaf-scripts.com/fivem/lb-phone/icons/Birdy.png"
    },
    InstaPic = {
      Username = "InstaPic",
      Avatar = "https://loaf-scripts.com/fivem/lb-phone/icons/InstaPic.png"
    }
  }
}

Config.BirdyTrending = {
  Enabled = true,
  Reset = 168
}

Config.BirdyNotifications = false

Config.PromoteBirdy = {
  Enabled = true,
  Cost = 2500,
  Views = 100
}

-- Text-To-Speech Voices list omitted for brevity --

Config.Crypto = {
  Enabled = true,
  Coins = {
    "bitcoin", "ethereum", "tether", "binancecoin", "usd-coin", "ripple",
    "binance-usd", "cardano", "dogecoin", "solana", "shiba-inu", "polkadot",
    "litecoin", "bitcoin-cash"
  },
  Currency = "usd",
  Refresh = 300000,
  QBit = true
}

Config.KeyBinds = {
  Open = { Command = "phone", Bind = "F1", Description = "Open your phone" },
  Focus = { Command = "togglePhoneFocus", Bind = "LMENU", Description = "Toggle cursor on your phone" },
  StopSounds = { Command = "stopSounds", Bind = false, Description = "Stop all phone sounds" },
  FlipCamera = { Command = "flipCam", Bind = "UP", Description = "Flip phone camera" },
  TakePhoto = { Command = "takePhoto", Bind = "RETURN", Description = "Take a photo / video" },
  ToggleFlash = { Command = "toggleCameraFlash", Bind = "E", Description = "Toggle flash" },
  LeftMode = { Command = "leftMode", Bind = "LEFT", Description = "Change mode" },
  RightMode = { Command = "rightMode", Bind = "RIGHT", Description = "Change mode" },
  AnswerCall = { Command = "answerCall", Bind = "RETURN", Description = "Answer incoming call" },
  DeclineCall = { Command = "declineCall", Bind = "BACK", Description = "Decline incoming call" },
  UnlockPhone = { Bind = "SPACE", Description = "Open your phone" }
}

Config.KeepInput = true

Config.UploadMethod = {
  Video = "Fivemanage",
  Image = "Fivemanage",
  Audio = "Fivemanage"
}

Config.Video = {
  Bitrate = 400,
  FrameRate = 24,
  MaxSize = 25,
  MaxDuration = 60
}

Config.Image = {
  Mime = "image/webp",
  Quality = 0.95
}

-- Function for printing error and warning messages periodically
local function printConfigWarning(message)
  Citizen.CreateThreadNow(function()
    while true do
      infoprint("error", message)
      Wait(5000)
    end
  end)
end

-- Validate config existence and warn for missing keys, etc.
if not Config then
  printConfigWarning("You've broken the config. Re-install the script, and it will work.")
end

for key, value in pairs(Config) do
  if Config[key] == nil then
    print("^3[WARNING]^7 Missing config key: ^2" .. key .. "^7, using default value.")
    Config[key] = value
  end
end

local prefixLength = #Config.PhoneNumber.Prefixes[1]

for i = 1, #Config.PhoneNumber.Prefixes do
  local prefix = Config.PhoneNumber.Prefixes[i]
  if #prefix ~= prefixLength then
    infoprint("error", "The phone number prefix ^5" .. prefix .. "^7 is not the same length as the other prefixes.")
  end
end

local currentResource = GetCurrentResourceName()
if currentResource ~= "lb-phone" then
  printConfigWarning(
  "The resource name is not ^2lb-phone^7. The resource will not work properly. Please change the resource name to ^2lb-phone^7.")
end

if Config.Item.Name and Config.Item.Names then
  printConfigWarning("You have both ^2Item.Name^7 and ^2Item.Names^7 in your config. Please remove one of them.")
end

if Config.Item.Unique and not Config.Item.Require then
  printConfigWarning(
  "You have ^2Item.Unique^7 set to true, but ^2Item.Require^7 is set to false. Please set ^2Item.Require^7 to true, or set Item.Unique to false.")
end

if not UploadMethods["Fivemanage"] then
  UploadMethods["Fivemanage"] = true
end

if not Config.UploadMethod then
  printConfigWarning("You've broken the Config.UploadMethod. (not set)")
else
  if not Config.UploadMethod.Video then
    printConfigWarning("Config.UploadMethod.Video is not set")
  elseif not UploadMethods[Config.UploadMethod.Video] then
    printConfigWarning("Config.UploadMethod.Video is not set to a valid upload method")
  end

  if not Config.UploadMethod.Image then
    printConfigWarning("Config.UploadMethod.Image is not set")
  elseif not UploadMethods[Config.UploadMethod.Image] then
    printConfigWarning("Config.UploadMethod.Image is not set to a valid upload method")
  end

  if not Config.UploadMethod.Audio then
    printConfigWarning("Config.UploadMethod.Audio is not set")
  elseif not UploadMethods[Config.UploadMethod.Audio] then
    printConfigWarning("Config.UploadMethod.Audio is not set to a valid upload method")
  end
end

L3_1 = _ENV
L4_1 = "PerformHttpRequest"
L3_1 = L3_1[L4_1]
L4_1 = "https://loaf-scripts.com/versions/"
function L5_1(A0_2, A1_2, A2_2)
  local L3_2, L4_2
  if A1_2 then
    L3_2 = print
    L4_2 = A1_2
    L3_2(L4_2)
  end
end

L6_1 = "POST"
L7_1 = _ENV
L8_1 = "json"
L7_1 = L7_1[L8_1]
L8_1 = "encode"
L7_1 = L7_1[L8_1]
L8_1 = {}
L9_1 = "resource"
L8_1[L9_1] = "phone"
L9_1 = "version"
L10_1 = _ENV
L11_1 = "GetResourceMetadata"
L10_1 = L10_1[L11_1]
L11_1 = _ENV
L12_1 = "GetCurrentResourceName"
L11_1 = L11_1[L12_1]
L11_1 = L11_1()
L12_1 = "version"
L13_1 = 0
L10_1 = L10_1(L11_1, L12_1, L13_1)
if not L10_1 then
  L10_1 = "0.0.0"
end
L8_1[L9_1] = L10_1
L7_1 = L7_1(L8_1)
L8_1 = {}
L9_1 = "Content-Type"
L10_1 = "application/json"
L8_1[L9_1] = L10_1
L3_1(L4_1, L5_1, L6_1, L7_1, L8_1)
