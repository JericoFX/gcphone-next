import type { Call, Contact, Message } from '../types';

type AnyRecord = Record<string, unknown>;

interface BrowserMockState {
  phoneNumber: string;
  wallpaper: string;
  ringtone: string;
  volume: number;
  lockCode: string;
  coque: string;
  theme: 'auto' | 'light' | 'dark';
  language: 'es' | 'en' | 'pt' | 'fr';
  audioProfile: 'normal' | 'street' | 'vehicle' | 'silent';
  contacts: Contact[];
  messages: Message[];
  calls: Call[];
  gallery: Array<{ id: number; url: string; type: 'image' | 'video'; created_at: string }>;
  balance: number;
  transactions: Array<{ id: number; description: string; amount: number; time: string }>;
  appLayout: { home: string[]; menu: string[] };
  airplaneMode: boolean;
}

type GalleryEntry = BrowserMockState['gallery'][number];

const nowIso = () => new Date().toISOString();

const state: BrowserMockState = {
  phoneNumber: '555-1234',
  wallpaper: './img/background/back001.jpg',
  ringtone: 'ring.ogg',
  volume: 0.5,
  lockCode: '1234',
  coque: 'sin_funda.png',
  theme: 'light',
  language: 'es',
  audioProfile: 'normal',
  contacts: [
    { id: 1, display: 'Maria Garcia', number: '555-1111', favorite: true },
    { id: 2, display: 'Juan Perez', number: '555-2222', favorite: false },
    { id: 3, display: 'Ana Lopez', number: '555-3333', favorite: false },
  ],
  messages: [
    {
      id: 1,
      transmitter: '555-1111',
      receiver: '555-1234',
      message: 'Estas por la ciudad?',
      isRead: false,
      owner: 0,
      time: nowIso(),
    },
  ],
  calls: [
    {
      id: 1,
      owner: '555-1234',
      num: '555-2222',
      incoming: false,
      accepts: true,
      duration: 62,
      hidden: false,
      time: nowIso(),
    },
  ],
  gallery: [
    { id: 1, url: './img/background/back001.jpg', type: 'image', created_at: nowIso() },
    { id: 2, url: './img/background/neon.jpg', type: 'image', created_at: nowIso() },
  ],
  balance: 24500,
  transactions: [
    { id: 1, description: 'Pago recibido', amount: 3500, time: nowIso() },
    { id: 2, description: 'Transferencia enviada', amount: -1200, time: nowIso() },
  ],
  appLayout: {
    home: ['contacts', 'messages', 'calls', 'settings', 'gallery', 'camera', 'bank', 'wallet', 'documents', 'wavechat', 'music', 'chirp', 'snap', 'clips', 'darkrooms', 'yellowpages', 'market', 'news', 'garage', 'clock', 'notes', 'maps', 'weather'],
    menu: ['appstore']
  },
  airplaneMode: false,
};

const emitMessage = (action: string, data?: unknown) => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { action, data },
    })
  );
};

const phonePayload = () => ({
  phoneNumber: state.phoneNumber,
  wallpaper: state.wallpaper,
  ringtone: state.ringtone,
  volume: state.volume,
  lockCode: state.lockCode,
  coque: state.coque,
  theme: state.theme,
  language: state.language,
  audioProfile: state.audioProfile,
  appLayout: state.appLayout,
  enabledApps: [...state.appLayout.home, ...state.appLayout.menu],
  featureFlags: {
    appstore: true,
    wavechat: true,
    darkrooms: true,
    clips: true,
    wallet: true,
    documents: true,
    music: true,
    yellowpages: true,
  },
});

let nextContactId = 4;
let nextMessageId = 2;
let nextPhotoId = 3;
let nextCallId = 2;
let started = false;

export function setupBrowserMock() {
  if (started) return;
  started = true;

  setTimeout(() => {
    emitMessage('initPhone', phonePayload());
    emitMessage('showPhone', phonePayload());
  }, 120);

  (window as Window & { gcphoneMock?: AnyRecord }).gcphoneMock = {
    reset: () => {
      emitMessage('hidePhone');
      setTimeout(() => emitMessage('showPhone', phonePayload()), 100);
    },
    incomingMessage: () => {
      const incoming: Message = {
        id: nextMessageId++,
        transmitter: '555-3333',
        receiver: state.phoneNumber,
        message: 'Mock: mensaje entrante',
        isRead: false,
        owner: 0,
        time: nowIso(),
      };
      state.messages.push(incoming);
      emitMessage('messageReceived', incoming);
    },
    incomingCall: () => {
      emitMessage('incomingCall', {
        id: nextCallId++,
        transmitterNum: '555-1111',
        receiverNum: state.phoneNumber,
        hidden: false,
      });
    },
    contactRequest: () => {
      emitMessage('receiveContactRequest', {
        fromPlayer: 'Mock Player',
        fromServerId: 7,
        contact: {
          display: 'Mecanico',
          number: '555-4444',
        },
      });
    },
  };
}

export function handleBrowserNui<T = unknown>(eventName: string, data?: unknown): T | undefined {
  const payload = (data ?? {}) as AnyRecord;

  if (eventName === 'nuiReady') {
    return true as T;
  }

  if (eventName === 'closePhone') {
    emitMessage('hidePhone');
    return true as T;
  }

  if (eventName === 'getAppLayout') {
    return {
      home: [...state.appLayout.home],
      menu: [...state.appLayout.menu]
    } as T;
  }

  if (eventName === 'setAppLayout') {
    const layout = payload.layout as { home?: string[]; menu?: string[] } | undefined;
    if (layout && Array.isArray(layout.home) && Array.isArray(layout.menu)) {
      state.appLayout = {
        home: [...layout.home],
        menu: [...layout.menu]
      };
    }
    return true as T;
  }

  if (eventName === 'getContacts') {
    return [...state.contacts] as T;
  }

  if (eventName === 'addContact') {
    const contact: Contact = {
      id: nextContactId++,
      display: String(payload.display || ''),
      number: String(payload.number || ''),
      avatar: typeof payload.avatar === 'string' ? payload.avatar : undefined,
      favorite: false,
    };
    state.contacts.push(contact);
    emitMessage('contactsUpdated', [...state.contacts]);
    return { success: true, id: contact.id } as T;
  }

  if (eventName === 'updateContact') {
    const id = Number(payload.id || 0);
    state.contacts = state.contacts.map((contact) =>
      contact.id === id
        ? {
            ...contact,
            display: String(payload.display || contact.display),
            number: String(payload.number || contact.number),
            avatar: typeof payload.avatar === 'string' ? payload.avatar : contact.avatar,
          }
        : contact
    );
    emitMessage('contactsUpdated', [...state.contacts]);
    return { success: true } as T;
  }

  if (eventName === 'deleteContact') {
    const id = Number(payload.id || 0);
    state.contacts = state.contacts.filter((contact) => contact.id !== id);
    emitMessage('contactsUpdated', [...state.contacts]);
    return { success: true } as T;
  }

  if (eventName === 'toggleFavorite') {
    const id = Number(payload.id || 0);
    state.contacts = state.contacts.map((contact) =>
      contact.id === id ? { ...contact, favorite: !contact.favorite } : contact
    );
    emitMessage('contactsUpdated', [...state.contacts]);
    return { success: true } as T;
  }

  if (eventName === 'getMessages') {
    return [...state.messages].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()) as T;
  }

  if (eventName === 'sendMessage') {
    const phoneNumber = String(payload.phoneNumber || '');
    const text = String(payload.message || '');
    const mediaUrl = typeof payload.mediaUrl === 'string' ? payload.mediaUrl : undefined;
    const sent: Message = {
      id: nextMessageId++,
      transmitter: state.phoneNumber,
      receiver: phoneNumber,
      message: text,
      mediaUrl,
      isRead: true,
      owner: 1,
      time: nowIso(),
    };
    state.messages.push(sent);
    emitMessage('messageSent', sent);
    return { success: true } as T;
  }

  if (eventName === 'deleteMessage') {
    const id = Number(payload.id || 0);
    state.messages = state.messages.filter((msg) => msg.id !== id);
    emitMessage('messagesUpdated', [...state.messages]);
    return { success: true } as T;
  }

  if (eventName === 'deleteConversation') {
    const phoneNumber = String(payload.phoneNumber || '');
    state.messages = state.messages.filter(
      (msg) => msg.transmitter !== phoneNumber && msg.receiver !== phoneNumber
    );
    emitMessage('messagesUpdated', [...state.messages]);
    return { success: true } as T;
  }

  if (eventName === 'markAsRead') {
    const phoneNumber = String(payload.phoneNumber || '');
    state.messages = state.messages.map((msg) =>
      msg.transmitter === phoneNumber && msg.owner === 0 ? { ...msg, isRead: true } : msg
    );
    emitMessage('messagesUpdated', [...state.messages]);
    return { success: true } as T;
  }

  if (eventName === 'setWallpaper') {
    state.wallpaper = String(payload.url || state.wallpaper);
    emitMessage('showPhone', phonePayload());
    return true as T;
  }

  if (eventName === 'setRingtone') {
    state.ringtone = String(payload.ringtone || state.ringtone);
    return true as T;
  }

  if (eventName === 'setVolume') {
    state.volume = Number(payload.volume ?? state.volume);
    return true as T;
  }

  if (eventName === 'setLockCode') {
    state.lockCode = String(payload.code || state.lockCode);
    return true as T;
  }

  if (eventName === 'setCoque') {
    state.coque = String(payload.coque || state.coque);
    return true as T;
  }

  if (eventName === 'setAirplaneMode') {
    state.airplaneMode = Boolean(payload.enabled);
    return true as T;
  }

  if (eventName === 'setTheme') {
    const nextTheme = String(payload.theme || state.theme);
    if (nextTheme === 'auto' || nextTheme === 'light' || nextTheme === 'dark') {
      state.theme = nextTheme;
    }
    return true as T;
  }

  if (eventName === 'setLanguage') {
    const next = String(payload.language || state.language);
    if (next === 'es' || next === 'en' || next === 'pt' || next === 'fr') {
      state.language = next;
    }
    return true as T;
  }

  if (eventName === 'setAudioProfile') {
    const nextProfile = String(payload.audioProfile || state.audioProfile);
    if (nextProfile === 'normal' || nextProfile === 'street' || nextProfile === 'vehicle' || nextProfile === 'silent') {
      state.audioProfile = nextProfile;
    }
    return true as T;
  }

  if (eventName === 'getCallHistory') {
    return [...state.calls] as T;
  }

  if (eventName === 'startCall') {
    if (state.airplaneMode) {
      return { error: 'AIRPLANE_MODE_CALL_BLOCKED' } as T;
    }
    return {
      id: nextCallId++,
      transmitterNum: state.phoneNumber,
      receiverNum: String(payload.phoneNumber || ''),
      isValid: true,
      hidden: false,
    } as T;
  }

  if (eventName === 'livekitGetToken') {
    const roomName = String(payload.roomName || `call-${Date.now()}`);
    return {
      success: true,
      url: 'ws://127.0.0.1:7880',
      token: 'mock-livekit-token',
      roomName,
      identity: `mock:${state.phoneNumber}`,
    } as T;
  }

  if (eventName === 'socketGetToken') {
    return {
      success: true,
      host: 'ws://127.0.0.1:3001',
      token: 'mock-socket-token',
    } as T;
  }

  if (eventName === 'endCall') {
    return true as T;
  }

  if (eventName === 'getGallery') {
    return [...state.gallery] as T;
  }

  if (eventName === 'getUploadConfig') {
    return { uploadUrl: '', uploadField: 'files[]' } as T;
  }

  if (eventName === 'getStorageConfig') {
    return {
      provider: 'custom',
      uploadUrl: '',
      uploadField: 'files[]',
      customUploadUrl: '',
      customUploadField: 'files[]',
      knownProviders: [
        { id: 'fivemanage', label: 'FiveManage', uploadUrl: 'https://api.fivemanage.com/api/image', uploadField: 'files[]' },
        { id: 'server_folder', label: 'Server folder', uploadUrl: '', uploadField: '' },
        { id: 'local', label: 'Local uploader', uploadUrl: 'http://127.0.0.1:3012/upload', uploadField: 'files[]' },
        { id: 'custom', label: 'Direct custom URL', uploadUrl: '', uploadField: 'files[]' },
      ],
      maxVideoSizeMB: 50,
      maxVideoDurationSeconds: 60,
    } as T;
  }

  if (eventName === 'storeMediaUrl') {
    const url = String(payload.url || '');
    if (!url) return { success: false } as T;
    const row: GalleryEntry = {
      id: nextPhotoId++,
      url,
      type: url.includes('.mp4') || url.includes('.webm') || url.includes('.mov') ? 'video' : 'image',
      created_at: nowIso(),
    };
    state.gallery.unshift(row);
    return { success: true, id: row.id, url: row.url, type: row.type } as T;
  }

  if (eventName === 'takePhoto') {
    const photo: GalleryEntry = {
      id: nextPhotoId++,
      url: `./img/background/back00${Math.floor(Math.random() * 3) + 1}.jpg`,
      type: 'image' as const,
      created_at: nowIso(),
    };
    state.gallery.unshift(photo);
    return { url: photo.url } as T;
  }

  if (eventName === 'captureCameraVideoSession') {
    const clip: GalleryEntry = {
      id: nextPhotoId++,
      url: 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',
      type: 'video' as const,
      created_at: nowIso(),
    };
    state.gallery.unshift(clip);
    return { url: clip.url } as T;
  }

  if (eventName === 'deletePhoto') {
    const photoId = Number(payload.photoId || 0);
    state.gallery = state.gallery.filter((photo) => photo.id !== photoId);
    return true as T;
  }

  if (eventName === 'openGallery') {
    return true as T;
  }

  if (eventName === 'getBankBalance') {
    return state.balance as T;
  }

  if (eventName === 'getBankTransactions') {
    return [...state.transactions] as T;
  }

  if (eventName === 'getContactsForTransfer') {
    return state.contacts.map((contact) => ({ display: contact.display, number: contact.number })) as T;
  }

  if (eventName === 'transferMoney') {
    const amount = Number(payload.amount || 0);
    if (!amount || amount <= 0 || amount > state.balance) {
      return { success: false, message: 'Monto invalido' } as T;
    }

    state.balance -= amount;
    state.transactions.unshift({
      id: state.transactions.length + 1,
      description: `Transferencia a ${String(payload.targetNumber || 'destino')}`,
      amount: -amount,
      time: nowIso(),
    });

    return { success: true } as T;
  }

  if (eventName === 'chirpGetAccount') {
    return { id: 1, username: 'mockuser', display_name: 'Mock User' } as T;
  }

  if (eventName === 'chirpGetTweets') {
    return [
      { id: 1, username: 'maria', display_name: 'Maria', content: 'Bienvenidos a Chirp!', likes: 3, liked: false, created_at: nowIso() },
      { id: 2, username: 'juan', display_name: 'Juan', content: 'Servidor activo y funcionando.', likes: 7, liked: true, created_at: nowIso() }
    ] as T;
  }

  if (eventName === 'chirpPublishTweet') {
    return { success: true } as T;
  }

  if (eventName === 'chirpToggleLike') {
    return { liked: true } as T;
  }

  if (eventName === 'snapGetAccount') {
    return { id: 1, username: 'snapper', display_name: 'Snap User' } as T;
  }

  if (eventName === 'snapGetFeed') {
    return [
      { id: 1, username: 'ana', display_name: 'Ana', media_url: './img/background/playa.jpg', caption: 'Atardecer', likes: 12 },
      { id: 2, username: 'leo', display_name: 'Leo', media_url: './img/background/tokio.jpg', caption: 'Noche', likes: 9 }
    ] as T;
  }

  if (eventName === 'snapPublishPost') {
    return { success: true } as T;
  }

  if (eventName === 'snapToggleLike') {
    return { success: true } as T;
  }

  if (eventName === 'marketGetListings') {
    return [
      { id: 1, title: 'Banshee', description: 'Excelente estado', price: 15000, category: 'vehiculos' },
      { id: 2, title: 'Casa en Vinewood', description: 'Vista panoramica', price: 220000, category: 'propiedades' }
    ] as T;
  }

  if (eventName === 'marketCreateListing') {
    return { success: true, id: 99 } as T;
  }

  if (eventName === 'marketGetMyListings') {
    return [
      { id: 99, title: 'Mi Sultan', description: 'Unico dueno', price: 24000, category: 'vehiculos', status: 'active' }
    ] as T;
  }

  if (eventName === 'marketMarkAsSold' || eventName === 'marketDeleteListing') {
    return { success: true } as T;
  }

  if (eventName === 'marketContactSeller') {
    return { phoneNumber: '555-2222' } as T;
  }

  if (eventName === 'newsGetArticles') {
    return [
      { id: 1, author_name: 'Daily LS', title: 'Ultima hora', content: 'Evento en la ciudad', category: 'general', created_at: nowIso() },
      { id: 2, author_name: 'Canal 6', title: 'Transito', content: 'Demoras en autopista', category: 'trafico', created_at: nowIso() }
    ] as T;
  }

  if (eventName === 'newsPublishArticle') {
    return { success: true } as T;
  }

  if (eventName === 'newsGetCategories') {
    return ['general', 'trafico', 'policial'] as T;
  }

  if (eventName === 'newsDeleteArticle' || eventName === 'newsViewArticle') {
    return { success: true } as T;
  }

  if (eventName === 'newsStartLive') {
    return { success: true, articleId: 5 } as T;
  }

  if (eventName === 'newsEndLive') {
    return { success: true } as T;
  }

  if (eventName === 'garageGetVehicles') {
    return [
      { plate: 'ABC123', model_name: 'Banshee', garage_name: 'Pillbox', impounded: false },
      { plate: 'QBX777', model_name: 'Sultan', garage_name: 'Vespucci', impounded: false }
    ] as T;
  }

  if (eventName === 'garageRequestVehicle' || eventName === 'garageShareLocation') {
    return { success: true } as T;
  }

  if (eventName === 'snapGetStories') {
    return [
      { id: 1, username: 'ana', media_url: './img/background/neon.jpg' },
      { id: 2, username: 'leo', media_url: './img/background/oscuridad.jpg' }
    ] as T;
  }

  if (eventName === 'snapPublishStory') {
    return { success: true } as T;
  }

  if (eventName === 'snapGetLiveStreams') {
    return [{ id: 17, username: 'streamer', caption: 'En vivo', live_viewers: 12 }] as T;
  }

  if (eventName === 'snapStartLive') {
    return { success: true, postId: 17 } as T;
  }

  if (eventName === 'snapEndLive') {
    return { success: true } as T;
  }

  if (eventName === 'chirpDeleteTweet') {
    return { success: true } as T;
  }

  if (eventName === 'walletGetState') {
    return {
      balance: state.balance,
      cards: [
        { id: 1, label: 'Debito principal', last4: '1024', color: '#324A7A' },
        { id: 2, label: 'Card secundaria', last4: '7782', color: '#6E4A8A' },
      ],
      transactions: [
        { id: 1, amount: 2400, type: 'in', title: 'Pago recibido', created_at: nowIso() },
        { id: 2, amount: 700, type: 'out', title: 'Transferencia enviada', created_at: nowIso() },
      ],
    } as T;
  }

  if (eventName === 'walletTransfer') {
    return { success: true, balance: Math.max(0, state.balance - Number(payload.amount || 0)) } as T;
  }

  if (eventName === 'walletAddCard' || eventName === 'walletRemoveCard') {
    return { success: true } as T;
  }

  if (eventName === 'documentsGetList') {
    return [
      { id: 1, doc_type: 'id', title: 'DNI Digital', holder_name: 'Mock User', holder_number: '555-1234', expires_at: '2028-01-10', verification_code: 'AB12CD34', created_at: nowIso() },
      { id: 2, doc_type: 'license', title: 'Licencia', holder_name: 'Mock User', holder_number: 'LIC-1088', expires_at: '2027-09-18', verification_code: 'ZX98QR17', created_at: nowIso() },
    ] as T;
  }

  if (eventName === 'documentsCreate' || eventName === 'documentsDelete') {
    return { success: true } as T;
  }

  if (eventName === 'darkroomsGetRooms') {
    return [
      { id: 1, slug: 'general', name: '#General', description: 'Tablon central de la ciudad', icon: '🌙', members: 42, posts: 12, has_password: 0, is_member: 1 },
      { id: 2, slug: 'mercado', name: '#Mercado', description: 'Compra/venta y oportunidades', icon: '💼', members: 23, posts: 9, has_password: 1, is_member: 0 },
      { id: 3, slug: 'vehiculos', name: '#Vehiculos', description: 'Mecanica, meets y carreras', icon: '🏁', members: 18, posts: 5, has_password: 0, is_member: 1 },
    ] as T;
  }

  if (eventName === 'darkroomsJoinRoom') {
    if (payload.roomId === 2 && !payload.password) {
      return { success: false, error: 'PASSWORD_REQUIRED' } as T;
    }
    if (payload.roomId === 2 && payload.password !== '1234') {
      return { success: false, error: 'INVALID_PASSWORD' } as T;
    }
    return { success: true } as T;
  }

  if (eventName === 'darkroomsCreateRoom') {
    return { success: true, roomId: Math.floor(Math.random() * 900 + 100) } as T;
  }

  if (eventName === 'darkroomsGetPosts') {
    const roomId = Number(payload.roomId || 1);
    return [
      { id: roomId * 10 + 1, room_id: roomId, author_name: 'Anonimo', title: 'Guia rapida de la sala', content: 'Comparte info util y evita spam.', media_url: './img/background/neon.jpg', score: 7, comments_count: 2, my_vote: 0, created_at: nowIso() },
      { id: roomId * 10 + 2, room_id: roomId, author_name: 'NeoRP', title: 'Idea para evento comunitario', content: 'Podemos organizar meetup semanal en Legion.', media_url: '', score: 12, comments_count: 3, my_vote: 1, created_at: nowIso() },
    ] as T;
  }

  if (eventName === 'darkroomsCreatePost') {
    return { success: true } as T;
  }

  if (eventName === 'darkroomsVotePost') {
    return { success: true, score: Math.floor(Math.random() * 20), myVote: Number(payload.vote || 0) } as T;
  }

  if (eventName === 'darkroomsGetComments') {
    return [
      { id: 1, post_id: Number(payload.postId || 0), author_name: 'Mod LS', content: 'Mantengan el hilo ordenado.', media_url: '', created_at: nowIso() },
      { id: 2, post_id: Number(payload.postId || 0), author_name: 'Civ-21', content: 'Gracias por el aporte.', media_url: './img/background/back002.jpg', created_at: nowIso() },
    ] as T;
  }

  if (eventName === 'darkroomsCreateComment') {
    return { success: true } as T;
  }

  if (eventName === 'acceptContactRequest' || eventName === 'acceptFriendRequest' || eventName === 'rejectFriendRequest') {
    return { success: true } as T;
  }

  if (eventName === 'setGPS') {
    return true as T;
  }

  if (eventName === 'musicSearchCatalog' || eventName === 'musicSearchITunes') {
    const term = String(payload.query || 'Track').trim() || 'Track';
    return {
      success: true,
      results: [
        {
          videoId: 'dQw4w9WgXcQ',
          title: `${term} - Live Session`,
          channel: 'Mock Channel',
          thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        },
        {
          videoId: '9bZkp7q19f0',
          title: `${term} - Remix`,
          channel: 'Mock Studio',
          thumbnail: 'https://i.ytimg.com/vi/9bZkp7q19f0/mqdefault.jpg',
          url: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
        },
      ],
    } as T;
  }

  if (eventName === 'musicPlay' || eventName === 'musicPause' || eventName === 'musicResume' || eventName === 'musicStop' || eventName === 'musicSetVolume') {
    const actionMap: Record<string, { isPlaying?: boolean; isPaused?: boolean }> = {
      musicPlay: { isPlaying: true, isPaused: false },
      musicPause: { isPlaying: true, isPaused: true },
      musicResume: { isPlaying: true, isPaused: false },
      musicStop: { isPlaying: false, isPaused: false },
      musicSetVolume: {},
    };

    emitMessage('musicStateUpdated', {
      ...(actionMap[eventName] || {}),
      title: typeof payload.title === 'string' && payload.title ? payload.title : 'Mock Track',
      volume: typeof payload.volume === 'number' ? payload.volume : state.volume,
      distance: typeof payload.distance === 'number' ? payload.distance : 15,
      success: true,
    });

    return { success: true } as T;
  }

  return undefined;
}
