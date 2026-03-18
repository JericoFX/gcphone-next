Config = Config or {}

Config.NativeAudio = {
    Enabled = true,
    PlaceholderMode = false,
    IncomingCallStateBag = 'gcphoneIncomingCall',
    PreviewDurationMs = 5000,

    Bank = 'audiodirectory/sounds',
    SoundSet = 'gcphone',

    DefaultByCategory = {
        ringtone = 'call_1',
        notification = 'notif_1',
        message = 'msg_1',
        vibrate = 'buzz_short_01',
    },
    LegacyMap = {
        ['ring.ogg'] = 'call_1',
        ['ring2.ogg'] = 'call_2',
        ['iphone11.ogg'] = 'call_2',
        ['soft-ping.ogg'] = 'notif_1',
        ['glass.ogg'] = 'notif_1',
        ['orbit.ogg'] = 'notif_1',
        ['pop.ogg'] = 'msg_1',
        ['bubble.ogg'] = 'msg_1',
        ['tap.ogg'] = 'msg_1',
    },
    Catalog = {
        -- RINGTONES
        call_1 = {
            label = 'Tono 1',
            category = 'ringtone',
            soundName = 'call_1',
            vibrando = 'call_vibrando',
        },
        call_2 = {
            label = 'Tono 2',
            category = 'ringtone',
            soundName = 'call_2',
            vibrando = 'call_vibrando',
        },
        call_3 = {
            label = 'Tono 3',
            category = 'ringtone',
            soundName = 'call_3',
            vibrando = 'call_vibrando',
        },
        call_4 = {
            label = 'Tono 4',
            category = 'ringtone',
            soundName = 'call_4',
            vibrando = 'call_vibrando',
        },
        call_5 = {
            label = 'Tono 5',
            category = 'ringtone',
            soundName = 'call_5',
            vibrando = 'call_vibrando',
        },
        call_6 = {
            label = 'Tono 6',
            category = 'ringtone',
            soundName = 'call_6',
            vibrando = 'call_vibrando',
        },
        call_7 = {
            label = 'Tono 7',
            category = 'ringtone',
            soundName = 'call_7',
            vibrando = 'call_vibrando',
        },
        call_8 = {
            label = 'Tono 8',
            category = 'ringtone',
            soundName = 'call_8',
            vibrando = 'call_vibrando',
        },
        call_9 = {
            label = 'Tono 9',
            category = 'ringtone',
            soundName = 'call_9',
            vibrando = 'call_vibrando',
        },
        call_10 = {
            label = 'Tono 10',
            category = 'ringtone',
            soundName = 'call_10',
            vibrando = 'call_vibrando',
        },
        call_11 = {
            label = 'Tono 11',
            category = 'ringtone',
            soundName = 'call_11',
            vibrando = 'call_vibrando',
        },
        call_12 = {
            label = 'Tono 12',
            category = 'ringtone',
            soundName = 'call_12',
            vibrando = 'call_vibrando',
        },
        call_13 = {
            label = 'Tono 13',
            category = 'ringtone',
            soundName = 'call_13',
            vibrando = 'call_vibrando',
        },

        -- VIBRACIÓN
        buzz_short_01 = {
            label = 'Vibración',
            category = 'vibrate',
            soundName = 'call_vibrando',
            vibrando = false,
        },

        -- NOTIFICACIONES
        notif_1 = {
            label = 'Notificación 1',
            category = 'notification',
            soundName = 'nueva_notificacion',
            vibrando = 'nueva_notificacion_vibrando',
        },
        notif_2 = {
            label = 'Notificación 2',
            category = 'notification',
            soundName = 'nueva_notificacion2',
            vibrando = 'nueva_notificacion_vibrando',
        },
        notif_3 = {
            label = 'Notificación 3',
            category = 'notification',
            soundName = 'nueva_notificacion3',
            vibrando = 'nueva_notificacion_vibrando',
        },
        pop_1 = {
            label = 'Pop 1',
            category = 'notification',
            soundName = 'pop',
            vibrando = false,
        },
        pop_2 = {
            label = 'Pop 2',
            category = 'notification',
            soundName = 'pop2',
            vibrando = false,
        },

        -- MENSAJES
        msg_1 = {
            label = 'Mensaje 1',
            category = 'message',
            soundName = 'nueva_notificacion',
            vibrando = 'nueva_notificacion_vibrando',
        },
        msg_2 = {
            label = 'Mensaje 2',
            category = 'message',
            soundName = 'nueva_notificacion2',
            vibrando = 'nueva_notificacion_vibrando',
        },
        msg_3 = {
            label = 'Mensaje 3',
            category = 'message',
            soundName = 'nueva_notificacion3',
            vibrando = 'nueva_notificacion_vibrando',
        },

        -- LLAMADA SALIENTE
        sonando = {
            label = 'Sonando',
            category = 'calling',
            soundName = 'sonando',
            vibrando = false,
        },
        sonando_corto = {
            label = 'Sonando Corto',
            category = 'calling',
            soundName = 'sonando_corto',
            vibrando = false,
        },
    },
}

Config.Phone = {
    KeyOpen = 288,
    KeyTakeCall = 38,

    NumberFormat = 'XXX-XXXX',
    NumberPrefix = { 555, 556, 557, 558, 559 },

    DefaultSettings = {
        wallpaper = './img/background/back001.jpg',
        ringtone = Config.NativeAudio.DefaultByCategory.ringtone,
        callRingtone = Config.NativeAudio.DefaultByCategory.ringtone,
        notificationTone = Config.NativeAudio.DefaultByCategory.notification,
        messageTone = Config.NativeAudio.DefaultByCategory.message,
        volume = 0.5,
        lockCode = '0000',
        theme = 'light',
        language = 'es',
        audioProfile = 'normal',
    },

    WarningMessageCount = 100,
    Setup = {
        RequireOnFirstUse = true,
        MinPinLength = 4,
        MaxPinLength = 4,
        EmergencyContacts = {
            { label = 'Policia', number = '911' },
            { label = 'EMS', number = '912' },
            { label = 'Bomberos', number = '913' },
        },
    },

    ExportAllowlist = {
        ['cad-system'] = true,
        ['cad-system-clean'] = true,
    },
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
    MaxCallDurationSeconds = 300,
}

Config.Socket = {
    Enabled = false,
}

Config.LiveLocation = {
    Enabled = true,
    UpdateIntervalSeconds = 10,
    MaxDurationMinutes = 15,
}

Config.Camera = {
    Enabled = true,
    AllowRunning = true,
    LookSensitivity = 7.5,
    PitchMax = 65.0,
    PitchMin = 22.0,
    YawMax = 95.0,
    RollStep = 2.5,
    LandscapeRoll = -90.0,
    RearOffset = {
        x = 0.02,
        y = -0.06,
        z = 0.72,
    },
    SelfieOffset = {
        x = 0.0,
        y = 0.72,
        z = 0.62,
    },
    VehicleRearOffset = {
        x = 0.18,
        y = 0.52,
        z = 0.88,
    },
    VehicleSelfieOffset = {
        x = 0.08,
        y = 1.05,
        z = 0.96,
    },
    Fov = {
        Min = 25.0,
        Max = 90.0,
        Default = 52.0,
    },
    QuickZooms = { 30.0, 52.0, 78.0 },
    Freeze = {
        Enabled = true,
        MaxDistance = 8.0,
    },
}

Config.PhoneVisual = {
    Text = {
        offset = { x = 0.0, y = 0.0, z = 0.0 },
        rotation = { x = 0.0, y = 0.0, z = 0.0 },
    },
    Call = {
        offset = { x = 0.02, y = 0.01, z = 0.0 },
        rotation = { x = 10.0, y = -8.0, z = 8.0 },
    },
    Camera = {
        offset = { x = 0.015, y = -0.01, z = 0.0 },
        rotation = { x = -4.0, y = 2.0, z = 10.0 },
    },
    CameraLandscape = {
        offset = { x = 0.01, y = 0.01, z = 0.0 },
        rotation = { x = -2.0, y = 0.0, z = 96.0 },
    },
    Live = {
        offset = { x = 0.015, y = -0.005, z = 0.0 },
        rotation = { x = -2.0, y = -4.0, z = 18.0 },
    },
}

Config.Flashlight = {
    Enabled = true,
    SyncDistance = 30.0,
    Distance = 18.0,
    Intensity = 1.1,
    Kelvin = {
        Min = 2600,
        Max = 9000,
        Default = 5200,
    },
    Lumens = {
        Min = 350,
        Max = 2200,
        Default = 1200,
    },
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
    Domain = 'jericofx.gg',
    MinAliasLength = 3,
    MaxAliasLength = 24,
    MaxSubjectLength = 120,
    MaxBodyLength = 4000,
    Attachments = {
        MaxCount = 5,
        MaxTotalSize = 31457280,
        AllowedTypes = { 'image', 'video', 'document', 'link' },
    },
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
    MaxVideoDurationSeconds = 30,
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

    -- Coordenadas de depositos (impound). El telefono muestra "Ir con GPS" al mas cercano.
    Impounds = {
        { label = 'Deposito LSPD', x = 409.09, y = -1622.65, z = 29.29 },
        { label = 'Deposito Sandy', x = 1649.67, y = 3789.61, z = 34.79 },
        { label = 'Deposito Paleto', x = -225.09, y = 6320.72, z = 31.49 },
    },

    -- Coordenadas de garages para spawn de vehiculos solicitados
    SpawnPoints = {
        { label = 'Garage LS', x = -339.15, y = -764.86, z = 33.97, h = 180.0 },
        { label = 'Garage Sandy', x = 1726.47, y = 3710.42, z = 34.26, h = 20.0 },
        { label = 'Garage Paleto', x = -177.48, y = 6386.83, z = 31.49, h = 315.0 },
    },
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

Config.PublishJobs = {
    news = { 'news', 'reporter', 'journalist' },
    chirp = {},
    snap = {},
    clips = {},
}

Config.Proximity = {
    ShareContactDistance = 3.0,
    ShareLocationDistance = 5.0,
    FriendRequestDistance = 5.0,
    ShareDocumentDistance = 2.0,
    ShareWalletDistance = 2.0,
    SharePhotoDistance = 3.0,
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
    Ringtones = { 'call_1', 'call_2', 'call_3', 'call_4', 'call_5', 'call_6', 'call_7', 'call_8', 'call_9', 'call_10', 'call_11', 'call_12', 'call_13' },
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
