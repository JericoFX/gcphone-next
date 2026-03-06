Config = Config or {}
Config.Phone = {
    KeyOpen = 288,
    KeyTakeCall = 38,
    
    NumberFormat = 'XXX-XXXX',
    NumberPrefix = { 555, 556, 557, 558, 559 },

    DefaultSettings = {
        wallpaper = './img/background/back001.jpg',
        ringtone = 'ring.ogg',
        volume = 0.5,
        lockCode = '0000',
        coque = 'funda_negra.png',
        theme = 'light',
        language = 'es',
        audioProfile = 'normal',
    },

    WarningMessageCount = 100,
}

Config.Contacts = {
    MaxContacts = 200,
    AllowSharing = true,
    ProximityDistance = 3.0,
}

Config.Messages = {
    MaxMessages = 500,
    MaxMessageLength = 500,
    AllowGPS = true,
    AllowPhotos = true,
}

Config.Calls = {
    UseWebRTC = true,
    MaxCallDuration = 3600,
    HiddenNumberPrefix = '#',

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
    Mail = true,
}

Config.Mail = {
    Enabled = true,
    Domain = 'noimotors.gg',
    MinAliasLength = 3,
    MaxAliasLength = 24,
    MaxSubjectLength = 120,
    MaxBodyLength = 4000,
}

Config.Security = {
    ReportCooldownMs = 3000,
    RateLimits = {
        messages = 900,
        wavechat = 700,
        chirp = 1400,
        snap = 1500,
        clips = 1500,
        market = 2500,
        news = 2500,
        wallet = 900,
        walletRequest = 1300,
    }
}

Config.Wallet = {
    InitialBalance = 2500,
    MaxTransferAmount = 500000,
    ProximityDistance = 3.0,
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

Config.Gallery = {
    MaxPhotos = 100,
    MaxPhotoSize = 5242880,
    AllowedFormats = { 'jpg', 'jpeg', 'png', 'gif', 'webp' },
    UploadUrl = '',
    UploadField = 'files[]',
}

Config.Bank = {
    TransferFee = 0,
    MaxTransferAmount = 1000000,
}

Config.Chirp = {
    MaxTweetLength = 280,
    MaxTweetsPerDay = 100,
    AllowMedia = true,
}

Config.Snap = {
    StoryDuration = 86400,
    MaxPostsPerDay = 50,
    AllowLive = true,
    MaxLiveDuration = 3600,
    LiveAudio = {
        Enabled = true,
        ListenDistance = 25.0,
        LeaveBufferMeters = 2.0,
        MinVolume = 0.08,
        MaxVolume = 1.0,
        DistanceCurve = 1.35,
        VolumeSmoothing = 0.35,
        UseMumbleRangeClamp = true,
        UpdateIntervalMs = 220,
    },
}

Config.Garage = {
    MaxVehicles = 20,
}

Config.Market = {
    MaxListings = 10,
    ListingDuration = 604800,
    MaxPhotos = 5,
    Categories = {
        { id = 'vehicles', label = 'Vehículos', icon = '🚗' },
        { id = 'properties', label = 'Propiedades', icon = '🏠' },
        { id = 'services', label = 'Servicios', icon = '🔧' },
        { id = 'items', label = 'Objetos', icon = '📦' },
        { id = 'other', label = 'Otros', icon = '📋' },
    },
}

Config.News = {
    MaxArticlesPerDay = 20,
    AllowLive = true,
    MaxLiveDuration = 3600,
    Categories = {
        { id = 'general', label = 'General', icon = '📰' },
        { id = 'urgent', label = 'Urgente', icon = '⚠️' },
        { id = 'police', label = 'Policial', icon = '🚔' },
        { id = 'events', label = 'Eventos', icon = '🎉' },
        { id = 'business', label = 'Negocios', icon = '💼' },
    },
}

Config.Proximity = {
    ShareContactDistance = 3.0,
    ShareLocationDistance = 5.0,
    FriendRequestDistance = 5.0,
    ShareDocumentDistance = 2.0,
    ShareWalletDistance = 2.0,
}

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

Config.Sounds = {
    Ringtones = { 'ring.ogg', 'ring2.ogg', 'iphone11.ogg', 'casa_papel.ogg', 'bella_ciao.ogg' },
    MessageSound = 'Menu_Accept',
    MessageSoundSet = 'Phone_SoundSet_Default',
}

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

Config.Framework = 'qbcore'

return Config
