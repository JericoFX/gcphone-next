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
  contacts: Contact[];
  messages: Message[];
  calls: Call[];
  gallery: Array<{ id: number; url: string; type: 'image' | 'video'; created_at: string }>;
  balance: number;
  transactions: Array<{ id: number; description: string; amount: number; time: string }>;
  appLayout: { home: string[]; menu: string[] };
  airplaneMode: boolean;
}

const nowIso = () => new Date().toISOString();

const state: BrowserMockState = {
  phoneNumber: '555-1234',
  wallpaper: './img/background/back001.jpg',
  ringtone: 'ring.ogg',
  volume: 0.5,
  lockCode: '1234',
  coque: 'sin_funda.png',
  theme: 'light',
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
    home: ['contacts', 'messages', 'calls', 'settings', 'gallery', 'camera', 'bank', 'wavechat', 'music', 'chirp', 'snap', 'yellowpages', 'market', 'news', 'garage', 'clock', 'notes', 'maps', 'weather'],
    menu: []
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
    const row = {
      id: nextPhotoId++,
      url,
      type: url.includes('.mp4') || url.includes('.webm') || url.includes('.mov') ? 'video' : 'image',
      created_at: nowIso(),
    };
    state.gallery.unshift(row);
    return { success: true, id: row.id, url: row.url, type: row.type } as T;
  }

  if (eventName === 'takePhoto') {
    const photo = {
      id: nextPhotoId++,
      url: `./img/background/back00${Math.floor(Math.random() * 3) + 1}.jpg`,
      type: 'image' as const,
      created_at: nowIso(),
    };
    state.gallery.unshift(photo);
    return { url: photo.url } as T;
  }

  if (eventName === 'captureCameraVideoSession') {
    const clip = {
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

  if (eventName === 'acceptContactRequest' || eventName === 'acceptFriendRequest' || eventName === 'rejectFriendRequest') {
    return { success: true } as T;
  }

  if (eventName === 'setGPS') {
    return true as T;
  }

  if (eventName === 'musicPlay' || eventName === 'musicPause' || eventName === 'musicResume' || eventName === 'musicStop' || eventName === 'musicSetVolume') {
    return { success: true } as T;
  }

  return undefined;
}
