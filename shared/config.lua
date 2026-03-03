-- gcphone-next Configuration
-- Verified: QBCore compatible config

Config = Config or {}

-- Phone Settings
Config.Phone = {
    KeyOpen = 288,              -- F1 - Key to open phone
    KeyTakeCall = 38,           -- E - Key to take call from fixe phone
    
    -- Phone number generation
    NumberFormat = 'XXX-XXXX',  -- Format: 555-1234
    NumberPrefix = { 555, 556, 557, 558, 559 },
    
    -- Default settings for new phones
    DefaultSettings = {
        wallpaper = './img/background/back001.jpg',
        ringtone = 'ring.ogg',
        volume = 0.5,
        lockCode = '0000',
        coque = 'funda_negra.png',
        theme = 'light',
        audioProfile = 'normal',
    },
    
    -- Warning message when SMS is full
    WarningMessageCount = 100,
}

-- Contacts Settings
Config.Contacts = {
    MaxContacts = 200,
    AllowSharing = true,
    ProximityDistance = 3.0,    -- meters
}

-- Messages Settings  
Config.Messages = {
    MaxMessages = 500,
    MaxMessageLength = 500,
    AllowGPS = true,
    AllowPhotos = true,
}

-- Calls Settings
Config.Calls = {
    UseWebRTC = true,           -- Enable WebRTC for voice/video
    MaxCallDuration = 3600,     -- 1 hour max
    HiddenNumberPrefix = '#',   -- Prefix to hide caller ID
    
    -- WebRTC Configuration
    RTCConfig = {
        iceServers = {
            { urls = 'stun:stun.l.google.com:19302' },
        }
    },
}

Config.LiveKit = {
    Enabled = true,
    Host = 'ws://127.0.0.1:7880',
    MaxCallDurationSeconds = 300,
}

Config.Socket = {
    Enabled = false,
    Host = 'ws://127.0.0.1:3001',
}

Config.LiveLocation = {
    Enabled = true,
    UpdateIntervalSeconds = 10,
    MaxDurationMinutes = 15,
}

Config.Music = {
    Enabled = true,
    DefaultVolume = 0.15,
    DefaultDistance = 15.0,
    MaxDistance = 30.0,
    MaxResults = 12,
    UpdatePositionInterval = 300,
}

Config.Features = {
    AppStore = true,
    WaveChat = true,
    DarkRooms = true,
    Clips = true,
    Wallet = true,
    Documents = true,
    Music = true,
    YellowPages = true,
}

Config.Wallet = {
    InitialBalance = 2500,
    MaxTransferAmount = 500000,
}

Config.Documents = {
    AllowCustomTitle = true,
}

Config.Storage = {
    Provider = 'fivemanage',
    FiveManage = {
        Endpoint = 'https://api.fivemanage.com/api/image',
        ApiKey = '',
        UploadField = 'files[]',
    },
    KnownProviders = {
        {
            id = 'fivemanage',
            label = 'FiveManage',
            uploadUrl = 'https://api.fivemanage.com/api/image',
            uploadField = 'files[]',
        },
        {
            id = 'server_folder',
            label = 'Server folder',
            uploadUrl = '',
            uploadField = '',
        },
        {
            id = 'local',
            label = 'Local uploader',
            uploadUrl = 'http://127.0.0.1:3012/upload',
            uploadField = 'files[]',
        },
        {
            id = 'direct',
            label = 'Direct custom URL',
            uploadUrl = '',
            uploadField = 'files[]',
        },
    },
    Custom = {
        UploadUrl = '',
        UploadField = 'files[]',
    },
    ServerFolder = {
        Path = 'cache/gcphone',
        PublicBaseUrl = '',
        Encoding = 'jpg',
        Quality = 0.92,
    },
    MaxVideoSizeMB = 50,
    MaxVideoDurationSeconds = 60,
}

-- Gallery Settings
Config.Gallery = {
    MaxPhotos = 100,
    MaxPhotoSize = 5242880,     -- 5MB
    AllowedFormats = { 'jpg', 'jpeg', 'png', 'gif', 'webp' },
    UploadUrl = '',             -- Set screenshot upload endpoint for camera captures
    UploadField = 'files[]',    -- Multipart field name for screenshot-basic
}

-- Bank Settings
Config.Bank = {
    TransferFee = 0,            -- Fee for transfers
    MaxTransferAmount = 1000000,
}

-- Chirp (Twitter clone) Settings
Config.Chirp = {
    MaxTweetLength = 280,
    MaxTweetsPerDay = 100,
    AllowMedia = true,
}

-- Snap (Instagram clone) Settings
Config.Snap = {
    StoryDuration = 86400,      -- 24 hours in seconds
    MaxPostsPerDay = 50,
    AllowLive = true,
    MaxLiveDuration = 3600,     -- 1 hour
}

-- Garage Settings
Config.Garage = {
    MaxVehicles = 20,
}

-- Market (Classifieds) Settings
Config.Market = {
    MaxListings = 10,
    ListingDuration = 604800,   -- 7 days in seconds
    MaxPhotos = 5,
    Categories = {
        { id = 'vehicles', label = 'Vehículos', icon = '🚗' },
        { id = 'properties', label = 'Propiedades', icon = '🏠' },
        { id = 'services', label = 'Servicios', icon = '🔧' },
        { id = 'items', label = 'Objetos', icon = '📦' },
        { id = 'other', label = 'Otros', icon = '📋' },
    },
}

-- News Settings
Config.News = {
    MaxArticlesPerDay = 20,
    AllowLive = true,
    MaxLiveDuration = 3600,     -- 1 hour
    Categories = {
        { id = 'general', label = 'General', icon = '📰' },
        { id = 'urgent', label = 'Urgente', icon = '⚠️' },
        { id = 'police', label = 'Policial', icon = '🚔' },
        { id = 'events', label = 'Eventos', icon = '🎉' },
        { id = 'business', label = 'Negocios', icon = '💼' },
    },
}

-- Proximity Settings (ox_target)
Config.Proximity = {
    ShareContactDistance = 3.0,
    ShareLocationDistance = 5.0,
    FriendRequestDistance = 5.0,
}

-- Fixe Phones (public phones)
Config.FixePhone = {
    ['911'] = { 
        name = 'Central de Emergencias', 
        coords = vector3(441.2, -979.7, 30.58) 
    },
    ['555-0001'] = { 
        name = 'Cabina Telefónica', 
        coords = vector3(372.25, -965.75, 28.58) 
    },
}

-- Sound files
Config.Sounds = {
    Ringtones = { 'ring.ogg', 'ring2.ogg', 'iphone11.ogg', 'casa_papel.ogg', 'bella_ciao.ogg' },
    MessageSound = 'Menu_Accept',
    MessageSoundSet = 'Phone_SoundSet_Default',
}

-- API Settings (for wallpapers)
Config.APIs = {
    Unsplash = {
        Enabled = false,
        APIKey = '',
        Collections = {},
    },
    Picsum = {
        Enabled = true,
    },
    Tenor = {
        Enabled = true,
        APIKey = '',
    },
    Piped = {
        Enabled = true,
        BaseUrl = 'https://piped.video',
    },
}

-- Framework detection
Config.Framework = 'qbcore'     -- 'qbcore' or 'qbox' or 'esx'

return Config
