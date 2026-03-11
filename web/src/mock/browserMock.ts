import type { Call, Contact, Message } from '../types';

type AnyRecord = Record<string, unknown>;

interface MailAttachment {
  type: 'image' | 'video' | 'document' | 'link';
  url: string;
  name?: string;
  mime?: string;
  size?: number;
  sourceApp?: string;
}

interface MockMailAccount {
  id: number;
  alias: string;
  email: string;
}

interface MockMailMessage {
  id: number;
  sender_email?: string;
  sender_alias?: string;
  recipient_email: string;
  recipient_alias?: string;
  subject?: string;
  body: string;
  attachments?: MailAttachment[];
  is_read?: number;
  created_at: number;
}

interface BrowserMockState {
  phoneNumber: string;
  framework: 'esx' | 'qbcore' | 'qbox' | 'unknown';
  wallpaper: string;
  ringtone: string;
  callRingtone: string;
  notificationTone: string;
  messageTone: string;
  volume: number;
  lockCode: string;
  theme: 'auto' | 'light' | 'dark';
  language: 'es' | 'en' | 'pt' | 'fr';
  audioProfile: 'normal' | 'street' | 'vehicle' | 'silent';
  requiresSetup: boolean;
  contacts: Contact[];
  messages: Message[];
  calls: Call[];
  gallery: Array<{ id: number; url: string; type: 'image' | 'video'; created_at: string }>;
  balance: number;
  transactions: Array<{ id: number; description: string; amount: number; time: string }>;
  appLayout: { home: string[]; menu: string[] };
  mailDomain: string;
  mailAccount: MockMailAccount | null;
  mailInbox: MockMailMessage[];
  mailSent: MockMailMessage[];
  airplaneMode: boolean;
  flashlightEnabled: boolean;
  flashlightKelvin: number;
  flashlightLumens: number;
}

type GalleryEntry = BrowserMockState['gallery'][number];

const nowIso = () => new Date().toISOString();

interface MockRealtimeConfig {
  socketHost: string;
  socketToken: string;
  livekitUrl: string;
  livekitToken: string;
  livekitIdentity: string;
  livekitApiKey: string;
  livekitApiSecret: string;
}

interface MockRealtimePreview {
  socket: {
    success: boolean;
    host: string;
    token: string;
  };
  livekit: {
    success: boolean;
    url: string;
    token: string;
    roomName: string;
    identity: string;
    apiKey: string;
    hasApiSecret: boolean;
  };
}

const MOCK_REALTIME_KEYS = {
  socketHost: 'gcphone:mock:socketHost',
  socketToken: 'gcphone:mock:socketToken',
  livekitUrl: 'gcphone:mock:livekitUrl',
  livekitToken: 'gcphone:mock:livekitToken',
  livekitIdentity: 'gcphone:mock:livekitIdentity',
  livekitApiKey: 'gcphone:mock:livekitApiKey',
} as const;

const DEFAULT_MOCK_SOCKET_HOST = 'ws://127.0.0.1:3001';
const DEFAULT_MOCK_LIVEKIT_URL = 'ws://127.0.0.1:7880';
const REALTIME_PANEL_ID = 'gcphone-mock-realtime-panel';
const textEncoder = new TextEncoder();

let realtimePanelCleanup: (() => void) | null = null;
let volatileLivekitApiSecret = '';

const sanitizeConfigValue = (value: unknown, maxLength = 512) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const readRealtimeConfig = (): MockRealtimeConfig => ({
  socketHost: sanitizeConfigValue(window.localStorage.getItem(MOCK_REALTIME_KEYS.socketHost), 200),
  socketToken: sanitizeConfigValue(window.localStorage.getItem(MOCK_REALTIME_KEYS.socketToken), 1000),
  livekitUrl: sanitizeConfigValue(window.localStorage.getItem(MOCK_REALTIME_KEYS.livekitUrl), 200),
  livekitToken: sanitizeConfigValue(window.localStorage.getItem(MOCK_REALTIME_KEYS.livekitToken), 2000),
  livekitIdentity: sanitizeConfigValue(window.localStorage.getItem(MOCK_REALTIME_KEYS.livekitIdentity), 120),
  livekitApiKey: sanitizeConfigValue(window.localStorage.getItem(MOCK_REALTIME_KEYS.livekitApiKey), 120),
  livekitApiSecret: volatileLivekitApiSecret,
});

const writeRealtimeConfig = (config: Partial<MockRealtimeConfig>) => {
  const nextSocketHost = sanitizeConfigValue(config.socketHost, 200);
  const nextSocketToken = sanitizeConfigValue(config.socketToken, 1000);
  const nextLivekitUrl = sanitizeConfigValue(config.livekitUrl, 200);
  const nextLivekitToken = sanitizeConfigValue(config.livekitToken, 2000);
  const nextLivekitIdentity = sanitizeConfigValue(config.livekitIdentity, 120);
  const nextLivekitApiKey = sanitizeConfigValue(config.livekitApiKey, 120);
  const nextLivekitApiSecret = sanitizeConfigValue(config.livekitApiSecret, 512);

  if (nextSocketHost) window.localStorage.setItem(MOCK_REALTIME_KEYS.socketHost, nextSocketHost);
  if (nextSocketToken) window.localStorage.setItem(MOCK_REALTIME_KEYS.socketToken, nextSocketToken);
  if (nextLivekitUrl) window.localStorage.setItem(MOCK_REALTIME_KEYS.livekitUrl, nextLivekitUrl);
  if (nextLivekitToken) window.localStorage.setItem(MOCK_REALTIME_KEYS.livekitToken, nextLivekitToken);
  if (nextLivekitIdentity) window.localStorage.setItem(MOCK_REALTIME_KEYS.livekitIdentity, nextLivekitIdentity);
  if (nextLivekitApiKey) window.localStorage.setItem(MOCK_REALTIME_KEYS.livekitApiKey, nextLivekitApiKey);
  if (Object.prototype.hasOwnProperty.call(config, 'livekitApiSecret')) {
    volatileLivekitApiSecret = nextLivekitApiSecret;
  }
};

const clearRealtimeConfig = () => {
  window.localStorage.removeItem(MOCK_REALTIME_KEYS.socketHost);
  window.localStorage.removeItem(MOCK_REALTIME_KEYS.socketToken);
  window.localStorage.removeItem(MOCK_REALTIME_KEYS.livekitUrl);
  window.localStorage.removeItem(MOCK_REALTIME_KEYS.livekitToken);
  window.localStorage.removeItem(MOCK_REALTIME_KEYS.livekitIdentity);
  window.localStorage.removeItem(MOCK_REALTIME_KEYS.livekitApiKey);
  volatileLivekitApiSecret = '';
};

const randomToken = (prefix: string, length: number) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = `${prefix}-`;
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
};

const sanitizeWsEndpoint = (value: unknown, fallback: string) => {
  const text = sanitizeConfigValue(value, 240);
  if (!text) return fallback;
  if (text.startsWith('ws://') || text.startsWith('wss://')) {
    return text;
  }
  return `ws://${text}`;
};

const saveRealtimeConfig = (config: Partial<MockRealtimeConfig>) => {
  clearRealtimeConfig();
  writeRealtimeConfig(config);
  return readRealtimeConfig();
};

const makeRealtimeConfig = (config: Partial<MockRealtimeConfig> = {}) => {
  const socketHost = sanitizeWsEndpoint(config.socketHost, DEFAULT_MOCK_SOCKET_HOST);
  const livekitUrl = sanitizeWsEndpoint(config.livekitUrl, DEFAULT_MOCK_LIVEKIT_URL);
  const socketToken = sanitizeConfigValue(config.socketToken, 1000) || randomToken('mock-socket', 24);
  const livekitToken = sanitizeConfigValue(config.livekitToken, 2000) || randomToken('mock-livekit', 36);
  const livekitIdentity = sanitizeConfigValue(config.livekitIdentity, 120) || `mock:${state.phoneNumber}`;
  const livekitApiKey = sanitizeConfigValue(config.livekitApiKey, 120);
  const livekitApiSecret = sanitizeConfigValue(config.livekitApiSecret, 512);

  return {
    socketHost,
    socketToken,
    livekitUrl,
    livekitToken,
    livekitIdentity,
    livekitApiKey,
    livekitApiSecret,
  } satisfies MockRealtimeConfig;
};

const updateRealtimeConfig = (config: Partial<MockRealtimeConfig>) => {
  return saveRealtimeConfig({
    ...readRealtimeConfig(),
    ...config,
  });
};

const stripWrappedQuotes = (value: string) => {
  const text = value.trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).trim();
  }
  return text;
};

const parseRealtimeInstallerText = (input: string): Partial<MockRealtimeConfig> => {
  const result: Partial<MockRealtimeConfig> = {};
  const lines = input.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    const setrMatch = line.match(/^setr\s+([a-zA-Z0-9_]+)\s+(.+)$/i);
    if (setrMatch) {
      const key = setrMatch[1].toLowerCase();
      const value = stripWrappedQuotes(setrMatch[2]);
      if (key === 'livekit_host') result.livekitUrl = value;
      else if (key === 'livekit_api_key') result.livekitApiKey = value;
      else if (key === 'livekit_api_secret') result.livekitApiSecret = value;
      else if (key === 'gcphone_socket_host') result.socketHost = value;
      continue;
    }

    const envMatch = line.match(/^([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
    if (!envMatch) continue;

    const key = envMatch[1].toUpperCase();
    const value = stripWrappedQuotes(envMatch[2]);
    if (key === 'LIVEKIT_HOST') result.livekitUrl = value;
    else if (key === 'LIVEKIT_API_KEY') result.livekitApiKey = value;
    else if (key === 'LIVEKIT_API_SECRET') result.livekitApiSecret = value;
    else if (key === 'GCPHONE_SOCKET_HOST') result.socketHost = value;
  }

  return result;
};

const buildRealtimeSetrText = () => {
  const realtime = readRealtimeConfig();
  const livekitHost = sanitizeWsEndpoint(realtime.livekitUrl, DEFAULT_MOCK_LIVEKIT_URL);
  const lines = [
    `setr livekit_host "${livekitHost}"`,
    `setr livekit_api_key "${realtime.livekitApiKey || 'gcphone'}"`,
    `setr livekit_api_secret "${realtime.livekitApiSecret || 'change-me-secret'}"`,
    'setr livekit_room_prefix "gcphone"',
    'setr livekit_max_call_duration "300"',
  ];

  if (realtime.socketHost) {
    lines.push(`setr gcphone_socket_host "${sanitizeWsEndpoint(realtime.socketHost, DEFAULT_MOCK_SOCKET_HOST)}"`);
  }

  return lines.join('\n');
};

const copyText = async (text: string) => {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }

  const fallback = document.createElement('textarea');
  fallback.value = text;
  fallback.style.position = 'fixed';
  fallback.style.opacity = '0';
  document.body.appendChild(fallback);
  fallback.focus();
  fallback.select();
  const ok = document.execCommand('copy');
  fallback.remove();
  return ok;
};

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const stringToBase64Url = (value: string) => bytesToBase64Url(textEncoder.encode(value));

const buildLivekitJwt = async (
  apiKey: string,
  apiSecret: string,
  roomName: string,
  identity: string,
  publish: boolean,
  maxDurationSeconds: number,
) => {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(30, Math.min(86400, Math.floor(maxDurationSeconds || 300)));

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const payload = {
    iss: apiKey,
    sub: identity,
    iat: now,
    nbf: now,
    exp: now + ttl,
    video: {
      roomJoin: true,
      room: roomName,
      canPublish: publish,
      canSubscribe: true,
      canPublishData: true,
    },
  };

  const encodedHeader = stringToBase64Url(JSON.stringify(header));
  const encodedPayload = stringToBase64Url(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signingKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', signingKey, textEncoder.encode(unsignedToken));
  const signature = bytesToBase64Url(new Uint8Array(signatureBuffer));

  return `${unsignedToken}.${signature}`;
};

const buildSocketTokenResult = () => {
  const realtime = readRealtimeConfig();
  return {
    success: true,
    host: realtime.socketHost || DEFAULT_MOCK_SOCKET_HOST,
    token: realtime.socketToken || 'mock-socket-token',
  };
};

const buildLivekitTokenPreview = (roomName: string) => {
  const realtime = readRealtimeConfig();
  return {
    success: true,
    url: realtime.livekitUrl || DEFAULT_MOCK_LIVEKIT_URL,
    token: realtime.livekitToken || 'mock-livekit-token',
    roomName,
    identity: realtime.livekitIdentity || `mock:${state.phoneNumber}`,
    apiKey: realtime.livekitApiKey,
    hasApiSecret: Boolean(realtime.livekitApiSecret),
  };
};

const buildLivekitTokenResult = async (roomName: string, publish: boolean, maxDurationSeconds: number) => {
  const realtime = readRealtimeConfig();
  const url = realtime.livekitUrl || DEFAULT_MOCK_LIVEKIT_URL;
  const identity = realtime.livekitIdentity || `mock:${state.phoneNumber}`;
  const hasManualToken = Boolean(realtime.livekitToken && realtime.livekitToken !== 'mock-livekit-token');
  let token = realtime.livekitToken || 'mock-livekit-token';

  if (!hasManualToken && realtime.livekitApiKey && realtime.livekitApiSecret && crypto?.subtle) {
    try {
      token = await buildLivekitJwt(
        realtime.livekitApiKey,
        realtime.livekitApiSecret,
        roomName,
        identity,
        publish,
        maxDurationSeconds,
      );
      updateRealtimeConfig({ livekitToken: token, livekitIdentity: identity });
    } catch (error) {
      console.warn('[gcphone mock] failed generating LiveKit JWT in browser mock', error);
    }
  }

  return {
    success: true,
    url,
    token,
    roomName,
    identity,
    apiKey: realtime.livekitApiKey,
    hasApiSecret: Boolean(realtime.livekitApiSecret),
  };
};

const buildRealtimePreview = (roomName = `call-${Date.now()}`): MockRealtimePreview => ({
  socket: buildSocketTokenResult(),
  livekit: buildLivekitTokenPreview(roomName),
});

const closeRealtimePanel = () => {
  if (realtimePanelCleanup) {
    realtimePanelCleanup();
    realtimePanelCleanup = null;
    return;
  }

  const stale = document.getElementById(REALTIME_PANEL_ID);
  if (stale) stale.remove();
};

const openRealtimePanel = () => {
  closeRealtimePanel();

  const root = document.createElement('div');
  root.id = REALTIME_PANEL_ID;
  root.style.position = 'fixed';
  root.style.right = '12px';
  root.style.bottom = '12px';
  root.style.width = '360px';
  root.style.maxHeight = '70vh';
  root.style.overflow = 'auto';
  root.style.padding = '12px';
  root.style.background = 'rgba(14,18,24,0.92)';
  root.style.backdropFilter = 'blur(8px)';
  root.style.border = '1px solid rgba(255,255,255,0.14)';
  root.style.borderRadius = '12px';
  root.style.zIndex = '999999';
  root.style.color = '#e5edf8';
  root.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  root.style.fontSize = '12px';
  root.style.lineHeight = '1.4';

  root.innerHTML = [
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">',
    '<strong>gcphone Mock Realtime Lab</strong>',
    '<button data-action="close" style="border:0;background:#1f2937;color:#e5edf8;border-radius:6px;padding:3px 7px;cursor:pointer;">x</button>',
    '</div>',
    '<label style="display:block;margin-bottom:6px;">Socket host</label>',
    '<input data-field="socketHost" style="width:100%;margin-bottom:8px;padding:6px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#dbeafe;" />',
    '<label style="display:block;margin-bottom:6px;">LiveKit URL</label>',
    '<input data-field="livekitUrl" style="width:100%;margin-bottom:8px;padding:6px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#dbeafe;" />',
    '<label style="display:block;margin-bottom:6px;">LiveKit API key (setup output)</label>',
    '<input data-field="livekitApiKey" style="width:100%;margin-bottom:8px;padding:6px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#dbeafe;" />',
    '<label style="display:block;margin-bottom:6px;">LiveKit API secret (setup output)</label>',
    '<input data-field="livekitApiSecret" type="password" style="width:100%;margin-bottom:8px;padding:6px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#dbeafe;" />',
    '<div style="margin:-4px 0 8px;color:#93c5fd;">Solo mock browser: el secret queda en memoria temporal (no localStorage).</div>',
    '<label style="display:block;margin-bottom:6px;">LiveKit token (optional)</label>',
    '<input data-field="livekitToken" style="width:100%;margin-bottom:8px;padding:6px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#dbeafe;" />',
    '<label style="display:block;margin-bottom:6px;">Identity</label>',
    '<input data-field="livekitIdentity" style="width:100%;margin-bottom:8px;padding:6px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#dbeafe;" />',
    '<label style="display:block;margin-bottom:6px;">Paste setup lines (.env or setr)</label>',
    '<textarea data-field="installerText" rows="4" style="width:100%;margin-bottom:10px;padding:6px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#dbeafe;resize:vertical;"></textarea>',
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">',
    '<button data-action="generate" style="border:0;background:#0ea5e9;color:#001018;border-radius:8px;padding:6px;cursor:pointer;">Generate mock</button>',
    '<button data-action="local" style="border:0;background:#22c55e;color:#052e16;border-radius:8px;padding:6px;cursor:pointer;">Use localhost</button>',
    '<button data-action="import" style="border:0;background:#14b8a6;color:#021410;border-radius:8px;padding:6px;cursor:pointer;">Import setup</button>',
    '<button data-action="save" style="border:0;background:#f59e0b;color:#1f1300;border-radius:8px;padding:6px;cursor:pointer;">Save fields</button>',
    '<button data-action="copysetr" style="border:0;background:#6366f1;color:#eef2ff;border-radius:8px;padding:6px;cursor:pointer;">Copy setr</button>',
    '<button data-action="clear" style="border:0;background:#ef4444;color:#250303;border-radius:8px;padding:6px;cursor:pointer;">Clear all</button>',
    '</div>',
    '<label style="display:block;margin-bottom:6px;">Preview token payloads</label>',
    '<pre data-field="preview" style="white-space:pre-wrap;background:#020617;border:1px solid #1e293b;border-radius:8px;padding:8px;max-height:220px;overflow:auto;"></pre>',
  ].join('');

  const socketHostInput = root.querySelector('[data-field="socketHost"]') as HTMLInputElement | null;
  const livekitUrlInput = root.querySelector('[data-field="livekitUrl"]') as HTMLInputElement | null;
  const livekitApiKeyInput = root.querySelector('[data-field="livekitApiKey"]') as HTMLInputElement | null;
  const livekitApiSecretInput = root.querySelector('[data-field="livekitApiSecret"]') as HTMLInputElement | null;
  const livekitTokenInput = root.querySelector('[data-field="livekitToken"]') as HTMLInputElement | null;
  const identityInput = root.querySelector('[data-field="livekitIdentity"]') as HTMLInputElement | null;
  const installerTextInput = root.querySelector('[data-field="installerText"]') as HTMLTextAreaElement | null;
  const previewNode = root.querySelector('[data-field="preview"]') as HTMLElement | null;

  if (!socketHostInput || !livekitUrlInput || !livekitApiKeyInput || !livekitApiSecretInput || !livekitTokenInput || !identityInput || !installerTextInput || !previewNode) {
    return;
  }

  const refill = () => {
    const realtime = readRealtimeConfig();
    socketHostInput.value = realtime.socketHost || DEFAULT_MOCK_SOCKET_HOST;
    livekitUrlInput.value = realtime.livekitUrl || DEFAULT_MOCK_LIVEKIT_URL;
    livekitApiKeyInput.value = realtime.livekitApiKey || '';
    livekitApiSecretInput.value = realtime.livekitApiSecret || '';
    livekitTokenInput.value = realtime.livekitToken || '';
    identityInput.value = realtime.livekitIdentity || `mock:${state.phoneNumber}`;
    previewNode.textContent = JSON.stringify(buildRealtimePreview('call-mock-lab'), null, 2);
  };

  const onClick = (event: Event) => {
    const target = event.target as HTMLElement | null;
    const action = target?.getAttribute('data-action');
    if (!action) return;

    if (action === 'close') {
      closeRealtimePanel();
      return;
    }

    if (action === 'clear') {
      clearRealtimeConfig();
      refill();
      return;
    }

    if (action === 'local') {
      saveRealtimeConfig(makeRealtimeConfig({
        socketHost: DEFAULT_MOCK_SOCKET_HOST,
        livekitUrl: DEFAULT_MOCK_LIVEKIT_URL,
        livekitApiKey: '',
        livekitApiSecret: '',
        livekitIdentity: `mock:${state.phoneNumber}`,
      }));
      refill();
      return;
    }

    if (action === 'import') {
      const parsed = parseRealtimeInstallerText(installerTextInput.value || '');
      if (Object.keys(parsed).length > 0) {
        updateRealtimeConfig(parsed);
      }
      refill();
      return;
    }

    if (action === 'generate') {
      saveRealtimeConfig(makeRealtimeConfig({
        socketHost: socketHostInput.value,
        livekitUrl: livekitUrlInput.value,
        livekitApiKey: livekitApiKeyInput.value,
        livekitApiSecret: livekitApiSecretInput.value,
        livekitToken: livekitTokenInput.value,
        livekitIdentity: identityInput.value,
      }));
      refill();
      return;
    }

    if (action === 'copysetr') {
      void copyText(buildRealtimeSetrText());
      return;
    }

    if (action === 'save') {
      updateRealtimeConfig({
        socketHost: sanitizeWsEndpoint(socketHostInput.value, DEFAULT_MOCK_SOCKET_HOST),
        livekitUrl: sanitizeWsEndpoint(livekitUrlInput.value, DEFAULT_MOCK_LIVEKIT_URL),
        livekitApiKey: sanitizeConfigValue(livekitApiKeyInput.value, 120),
        livekitApiSecret: sanitizeConfigValue(livekitApiSecretInput.value, 512),
        livekitToken: sanitizeConfigValue(livekitTokenInput.value, 2000),
        livekitIdentity: sanitizeConfigValue(identityInput.value, 120),
      });
      refill();
    }
  };

  root.addEventListener('click', onClick);
  document.body.appendChild(root);
  refill();

  realtimePanelCleanup = () => {
    root.removeEventListener('click', onClick);
    root.remove();
  };
};

const state: BrowserMockState = {
  phoneNumber: '555-1234',
  framework: 'esx',
  wallpaper: './img/background/back001.jpg',
  ringtone: 'call_1',
  callRingtone: 'call_1',
  notificationTone: 'notif_1',
  messageTone: 'msg_1',
  volume: 0.5,
  lockCode: '1234',
  theme: 'light',
  language: 'es',
  audioProfile: 'normal',
  requiresSetup: false,
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
    home: ['contacts', 'messages', 'mail', 'calls', 'settings', 'gallery', 'camera', 'bank', 'wallet', 'documents', 'wavechat', 'music', 'chirp', 'snap', 'clips', 'darkrooms', 'yellowpages', 'market', 'news', 'garage', 'notes', 'maps'],
    menu: ['appstore']
  },
  mailDomain: 'jericofx.gg',
  mailAccount: {
    id: 1,
    alias: 'mockuser',
    email: 'mockuser@jericofx.gg',
  },
  mailInbox: [
    {
      id: 1,
      sender_email: 'admin@jericofx.gg',
      sender_alias: 'Admin',
      recipient_email: 'mockuser@jericofx.gg',
      recipient_alias: 'mockuser',
      subject: 'Bienvenido a Mail',
      body: 'Tu cuenta de prueba ya esta activa en el mock.',
      attachments: [],
      is_read: 0,
      created_at: Date.now() - 1000 * 60 * 20,
    },
  ],
  mailSent: [
    {
      id: 2,
      sender_email: 'mockuser@jericofx.gg',
      sender_alias: 'mockuser',
      recipient_email: 'support@jericofx.gg',
      recipient_alias: 'support',
      subject: 'Prueba de envio',
      body: 'Este correo fue enviado desde el mock.',
      attachments: [],
      is_read: 1,
      created_at: Date.now() - 1000 * 60 * 10,
    },
  ],
  airplaneMode: false,
  flashlightEnabled: false,
  flashlightKelvin: 5200,
  flashlightLumens: 1200,
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
  framework: state.framework,
  imei: state.imei,
  deviceOwnerName: 'Jerico Mock',
  isStolen: false,
  stolenAt: null,
  stolenReason: null,
  wallpaper: state.wallpaper,
  ringtone: state.ringtone,
  callRingtone: state.callRingtone,
  notificationTone: state.notificationTone,
  messageTone: state.messageTone,
  volume: state.volume,
  lockCode: state.lockCode,
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
    mail: true,
    documents: true,
    music: true,
    yellowpages: true,
  },
  requiresSetup: state.requiresSetup,
  setup: {
    requiresSetup: state.requiresSetup,
    hasSnap: !state.requiresSetup,
    hasChirp: !state.requiresSetup,
    hasClips: !state.requiresSetup,
    hasMail: !state.requiresSetup || Boolean(state.mailAccount),
    mailDomain: state.mailDomain,
  },
  accessMode: 'own',
  accessOwnerName: undefined,
  accessPhoneId: undefined,
});

const resetMockPhoneData = () => {
  state.wallpaper = './img/background/back001.jpg';
  state.ringtone = 'call_1';
  state.callRingtone = 'call_1';
  state.notificationTone = 'notif_1';
  state.messageTone = 'msg_1';
  state.volume = 0.5;
  state.lockCode = '0000';
  state.theme = 'light';
  state.language = 'es';
  state.audioProfile = 'normal';
  state.requiresSetup = true;
  state.contacts = [];
  state.messages = [];
  state.calls = [];
  state.gallery = [];
  state.transactions = [];
  state.mailAccount = null;
  state.mailInbox = [];
  state.mailSent = [];
  state.airplaneMode = false;
  state.flashlightEnabled = false;
};

const showMockPhone = (overrides: AnyRecord = {}) => {
  emitMessage('showPhone', {
    ...phonePayload(),
    ...overrides,
  });
};

const bootMockPhone = () => {
  emitMessage('initPhone', phonePayload());
  showMockPhone();
};

let nextContactId = 4;
let nextMessageId = 2;
let nextPhotoId = 3;
let nextCallId = 2;
let nextMailMessageId = 3;
let nextWalletRequestId = 1;
let nextMockNewsId = 4;
let started = false;
let mockLiveLocationActive = false;
let mockLiveLocationInterval = 10;
const mockNewsArticles: Array<Record<string, unknown>> = [
  {
    id: 1,
    author_name: 'Daily LS',
    title: 'Ultima hora',
    content: 'Evento masivo en Legion Square con operativo especial.',
    category: 'general',
    media_url: './img/background/neon.jpg',
    created_at: nowIso(),
    is_live: 0,
    live_viewers: 0,
  },
  {
    id: 2,
    author_name: 'Canal 6',
    title: 'Transito',
    content: 'Demoras en autopista por obras, usar rutas alternativas.',
    category: 'trafico',
    media_url: './img/background/tokio.jpg',
    created_at: nowIso(),
    is_live: 1,
    live_viewers: 24,
  },
  {
    id: 3,
    author_name: 'Noticias Vespucci',
    title: 'Cultura',
    content: 'Festival de arte urbano durante todo el fin de semana.',
    category: 'general',
    media_url: './img/background/back004.jpg',
    created_at: nowIso(),
    is_live: 0,
    live_viewers: 0,
  },
];
const mockNewsScaleforms = new Map<number, Record<string, string>>([
  [2, { preset: 'breaking', headline: 'TRAFICO EN VIVO', subtitle: 'Cobertura desde la autopista', ticker: 'Desvios activos en este momento' }],
]);
const mockJoinedNewsLives = new Set<number>();
const mockNewsLiveMessages = new Map<number, Array<{ id: string; authorId: string; username: string; display: string; content: string; createdAt: number }>>([
  [2, [{ id: '2:1', authorId: 'mock-cronista', username: 'cronista', display: 'Cronista', content: 'Estamos saliendo en vivo desde la autopista.', createdAt: Date.now() }]],
]);
const mockMutedNewsUsers = new Map<number, Set<string>>();
const mockWalletRequests: Array<{
  id: number;
  requesterIdentifier: string;
  requesterPhone: string;
  targetIdentifier: string;
  targetPhone: string;
  amount: number;
  title: string;
  method: 'qr' | 'nfc';
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  expiresAt: string;
  createdAt: string;
}> = [];
const mockBlockedNumbers: Array<{ id: number; target_phone: string; reason?: string; created_at: string }> = [];
const mockSnapDiscoverAccounts = [
  {
    account_id: 101,
    username: 'ana.snap',
    display_name: 'Ana Rivera',
    avatar: './img/background/back002.jpg',
    bio: 'Fotografia y viajes',
    verified: 0,
    is_private: 0,
    followers: 120,
  },
  {
    account_id: 102,
    username: 'leo.private',
    display_name: 'Leo Morales',
    avatar: './img/background/back003.jpg',
    bio: 'Cuenta privada',
    verified: 0,
    is_private: 1,
    followers: 64,
  },
  {
    account_id: 103,
    username: 'official.city',
    display_name: 'City Official',
    avatar: './img/background/back004.jpg',
    bio: 'Noticias de la ciudad',
    verified: 1,
    is_private: 0,
    followers: 420,
  },
  {
    account_id: 104,
    username: 'nora.frames',
    display_name: 'Nora Frames',
    avatar: './img/background/playa.jpg',
    bio: 'Retratos y backstage',
    verified: 0,
    is_private: 0,
    followers: 210,
  },
  {
    account_id: 105,
    username: 'byte.cafe',
    display_name: 'Byte Cafe',
    avatar: './img/background/neon.jpg',
    bio: 'Cafe y codigo',
    verified: 1,
    is_private: 0,
    followers: 910,
  },
];

const mockSnapDiscoverPosts = [
  {
    id: 2001,
    account_id: 101,
    username: 'ana.snap',
    display_name: 'Ana Rivera',
    avatar: './img/background/back002.jpg',
    media_url: './img/background/playa.jpg',
    media_type: 'image',
    caption: 'Ruta costera en moto',
    likes: 41,
    is_private: 0,
    created_at: nowIso(),
  },
  {
    id: 2002,
    account_id: 102,
    username: 'leo.private',
    display_name: 'Leo Morales',
    avatar: './img/background/back003.jpg',
    media_url: './img/background/tokio.jpg',
    media_type: 'image',
    caption: 'Solo para close friends',
    likes: 19,
    is_private: 1,
    created_at: nowIso(),
  },
  {
    id: 2003,
    account_id: 103,
    username: 'official.city',
    display_name: 'City Official',
    avatar: './img/background/back004.jpg',
    media_url: './img/background/neon.jpg',
    media_type: 'image',
    caption: 'Cobertura del evento central',
    likes: 77,
    is_private: 0,
    created_at: nowIso(),
  },
  {
    id: 2004,
    account_id: 104,
    username: 'nora.frames',
    display_name: 'Nora Frames',
    avatar: './img/background/playa.jpg',
    media_url: './img/background/back005.jpg',
    media_type: 'image',
    caption: 'Sesion editorial nocturna',
    likes: 55,
    is_private: 0,
    created_at: nowIso(),
  },
  {
    id: 2005,
    account_id: 105,
    username: 'byte.cafe',
    display_name: 'Byte Cafe',
    avatar: './img/background/neon.jpg',
    media_url: './img/background/back001.jpg',
    media_type: 'image',
    caption: 'Nueva carta de temporada',
    likes: 103,
    is_private: 0,
    created_at: nowIso(),
  },
];

const mockSnapFollowing = new Set<number>();
const mockSnapSentRequests = new Set<number>();
const mockSnapPendingRequests: Array<{
  id: number;
  account_id: number;
  username: string;
  display_name: string;
  avatar?: string;
  is_private: number;
  created_at: string;
}> = [
  {
    id: 9001,
    account_id: 110,
    username: 'sara.live',
    display_name: 'Sara Live',
    avatar: './img/background/back005.jpg',
    is_private: 1,
    created_at: nowIso(),
  },
];

const mockYellowCategories = [
  { id: 'all', name: 'Todas', icon: 'all' },
  { id: 'autos', name: 'Autos', icon: 'car' },
  { id: 'properties', name: 'Propiedades', icon: 'home' },
  { id: 'electronics', name: 'Electronica', icon: 'phone' },
  { id: 'services', name: 'Servicios', icon: 'briefcase' },
  { id: 'jobs', name: 'Trabajo', icon: 'users' },
  { id: 'items', name: 'Objetos', icon: 'package' },
  { id: 'other', name: 'Otros', icon: 'more' },
];

const mockYellowListings: Array<{
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  photos: string[];
  views: number;
  created_at: string;
  seller_identifier: string;
  seller_name: string;
  seller_avatar?: string;
  seller_phone?: string;
}> = [
  {
    id: 201,
    title: 'Sultan RS impecable',
    description: 'Unico dueno, servicios al dia, listo para transferir.',
    price: 38500,
    category: 'autos',
    photos: ['./img/background/back002.jpg'],
    views: 128,
    created_at: nowIso(),
    seller_identifier: 'mock:ana',
    seller_name: 'Ana Rivera',
    seller_avatar: './img/background/back002.jpg',
    seller_phone: '555-1010',
  },
  {
    id: 202,
    title: 'Departamento centrico 2 ambientes',
    description: 'Excelente ubicacion, incluye cochera y balcon amplio.',
    price: 250000,
    category: 'properties',
    photos: ['./img/background/back003.jpg'],
    views: 86,
    created_at: nowIso(),
    seller_identifier: 'mock:leo',
    seller_name: 'Leo Morales',
    seller_avatar: './img/background/back003.jpg',
    seller_phone: '555-2020',
  },
  {
    id: 203,
    title: 'Servicio de fotografia para eventos',
    description: 'Cobertura completa con entrega en 24h.',
    price: 2800,
    category: 'services',
    photos: ['./img/background/neon.jpg'],
    views: 49,
    created_at: nowIso(),
    seller_identifier: 'mock:city',
    seller_name: 'City Studio',
    seller_avatar: './img/background/back004.jpg',
    seller_phone: '555-3030',
  },
  {
    id: 204,
    title: 'Laptop gamer RTX',
    description: '16GB RAM, SSD 1TB, estado excelente.',
    price: 14500,
    category: 'electronics',
    photos: ['./img/background/tokio.jpg'],
    views: 72,
    created_at: nowIso(),
    seller_identifier: 'mock:self',
    seller_name: 'Mock User',
    seller_avatar: './img/background/back001.jpg',
    seller_phone: state.phoneNumber,
  },
];

let nextYellowListingId = 205;

type MockChirpTab = 'forYou' | 'following' | 'myActivity';

const mockChirpTweetsByTab: Record<MockChirpTab, Array<Record<string, unknown>>> = {
  forYou: [
    {
      id: 1,
      username: 'maria',
      display_name: 'Maria',
      content: 'Bienvenidos a Chirp!',
      likes: 3,
      liked: false,
      rechirps: 1,
      rechirped: false,
      replies: 2,
      created_at: nowIso(),
    },
    {
      id: 2,
      username: 'juan',
      display_name: 'Juan',
      content: 'Servidor activo y funcionando.',
      likes: 7,
      liked: true,
      rechirps: 0,
      rechirped: false,
      replies: 1,
      created_at: nowIso(),
    },
  ],
  following: [
    {
      id: 11,
      username: 'ana.follow',
      display_name: 'Ana Follow',
      content: 'Nuevo evento hoy en Vespucci.',
      likes: 14,
      liked: false,
      rechirps: 3,
      rechirped: false,
      replies: 5,
      created_at: nowIso(),
    },
    {
      id: 12,
      username: 'leo.follow',
      display_name: 'Leo Follow',
      content: 'Abri stream en Snap, pasen a saludar.',
      likes: 6,
      liked: true,
      rechirps: 2,
      rechirped: true,
      replies: 0,
      created_at: nowIso(),
    },
  ],
  myActivity: [
    {
      id: 21,
      username: 'mockuser',
      display_name: 'Mock User',
      content: 'Publicando desde mi actividad en Chirp.',
      likes: 3,
      liked: false,
      rechirps: 0,
      rechirped: false,
      replies: 0,
      is_own: true,
      created_at: nowIso(),
    },
    {
      id: 22,
      username: 'maria',
      display_name: 'Maria',
      content: 'Este lo likeaste recien.',
      likes: 18,
      liked: true,
      rechirps: 1,
      rechirped: false,
      replies: 3,
      created_at: nowIso(),
    },
  ],
};

const mockChirpCommentsByTweet: Record<number, Array<Record<string, unknown>>> = {
  1: [
    {
      id: 1001,
      tweet_id: 1,
      username: 'leo',
      display_name: 'Leo',
      content: 'Buenisimo!',
      created_at: nowIso(),
    },
  ],
};

let nextChirpCommentId = 1100;

const emitPhoneNotification = (payload: Record<string, unknown>) => {
  window.dispatchEvent(new CustomEvent('phone:notification', { detail: payload }));
};

const chirpCloneTweets = (tab: MockChirpTab) =>
  mockChirpTweetsByTab[tab].map((tweet) => ({ ...tweet }));

const findMockChirpTweet = (tweetId: number) => {
  const tabs = Object.keys(mockChirpTweetsByTab) as MockChirpTab[];
  for (const tab of tabs) {
    const row = mockChirpTweetsByTab[tab].find((tweet) => Number(tweet.id) === tweetId);
    if (row) return row;
  }
  return null;
};

const unreadMailCount = () =>
  state.mailInbox.reduce((count, entry) => count + (Number(entry.is_read) === 0 ? 1 : 0), 0);

const sanitizeMailAttachments = (value: unknown): MailAttachment[] => {
  if (!Array.isArray(value)) return [];

  const allowed = new Set(['image', 'video', 'document', 'link']);
  const attachments: MailAttachment[] = [];

  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;

    const entry = raw as Record<string, unknown>;
    const type = String(entry.type || '').trim().toLowerCase();
    const url = String(entry.url || '').trim();
    if (!allowed.has(type) || !url) continue;

    attachments.push({
      type: type as MailAttachment['type'],
      url,
      name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : undefined,
      mime: typeof entry.mime === 'string' && entry.mime.trim() ? entry.mime.trim() : undefined,
      size: Number.isFinite(Number(entry.size)) ? Number(entry.size) : undefined,
      sourceApp: typeof entry.sourceApp === 'string' && entry.sourceApp.trim() ? entry.sourceApp.trim() : undefined,
    });

    if (attachments.length >= 10) break;
  }

  return attachments;
};

export function setupBrowserMock() {
  if (started) return;
  started = true;

  setTimeout(() => {
    bootMockPhone();
  }, 120);

  (window as Window & { gcphoneMock?: AnyRecord }).gcphoneMock = {
    reset: () => {
      resetMockPhoneData();
      emitMessage('hidePhone');
      setTimeout(() => showMockPhone(), 100);
    },
    showHome: () => {
      state.requiresSetup = false;
      showMockPhone();
    },
    showSetup: () => {
      state.requiresSetup = true;
      showMockPhone();
    },
    showLocked: () => {
      state.requiresSetup = false;
      showMockPhone({ useLockScreen: true, forceLockScreen: true });
    },
    boot: () => {
      bootMockPhone();
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
    hiddenNotification: () => {
      emitMessage('hidePhone');
      window.setTimeout(() => {
        emitPhoneNotification({
          id: `mock-hidden-${Date.now()}`,
          appId: 'chirp',
          title: 'Chirp',
          message: 'Maria hizo rechirp de tu chirp.',
          icon: '↻',
          durationMs: 4200,
          priority: 'high',
        });
      }, 120);
    },
    getRealtime: () => readRealtimeConfig(),
    setRealtime: (config: Partial<MockRealtimeConfig>) => {
      return updateRealtimeConfig(config);
    },
    clearRealtime: () => {
      clearRealtimeConfig();
      return readRealtimeConfig();
    },
    generateRealtime: (config: Partial<MockRealtimeConfig> = {}) => {
      return saveRealtimeConfig(makeRealtimeConfig(config));
    },
    importRealtimeFromText: (text: string) => {
      const parsed = parseRealtimeInstallerText(String(text || ''));
      if (Object.keys(parsed).length === 0) {
        return { ok: false, parsed, current: readRealtimeConfig() };
      }
      const current = updateRealtimeConfig(parsed);
      return { ok: true, parsed, current };
    },
    exportRealtimeAsSetr: () => buildRealtimeSetrText(),
    copyRealtimeAsSetr: async () => copyText(buildRealtimeSetrText()),
    previewRealtime: (roomName = `call-${Date.now()}`) => buildRealtimePreview(String(roomName)),
    useLocalRealtime: (socketToken = 'mock-socket-token', livekitToken = 'mock-livekit-token') => {
      return saveRealtimeConfig({
        socketHost: DEFAULT_MOCK_SOCKET_HOST,
        socketToken,
        livekitUrl: DEFAULT_MOCK_LIVEKIT_URL,
        livekitToken,
        livekitIdentity: `mock:${state.phoneNumber}`,
      });
    },
    openRealtimePanel: () => {
      openRealtimePanel();
      return true;
    },
    closeRealtimePanel: () => {
      closeRealtimePanel();
      return true;
    },
  };

  console.info('[gcphone mock] Realtime helpers: setRealtime/getRealtime/clearRealtime/generateRealtime/importRealtimeFromText/exportRealtimeAsSetr/copyRealtimeAsSetr/previewRealtime/openRealtimePanel');
}

export async function handleBrowserNui<T = unknown>(eventName: string, data?: unknown): Promise<T | undefined> {
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

  if (eventName === 'phoneGetSetupState') {
    return {
      success: true,
      requiresSetup: state.requiresSetup,
      setup: phonePayload().setup,
    } as T;
  }

  if (eventName === 'phoneCompleteSetup') {
    const pin = String(payload.pin || '').replace(/\D/g, '').slice(0, 6);
    const mailAlias = String(payload.mailAlias || '').trim().toLowerCase();
    const nextLanguage = String(payload.language || state.language);
    const nextTheme = String(payload.theme || state.theme);
    const nextAudioProfile = String(payload.audioProfile || state.audioProfile);
    const handles = [payload.snapUsername, payload.chirpUsername, payload.clipsUsername].map((value) => String(value || '').trim().toLowerCase());

    if (pin.length < 4 || handles.some((value) => !/^[a-z0-9._-]{3,32}$/.test(value)) || !/^[a-z0-9._-]{3,24}$/.test(mailAlias)) {
      return { success: false, error: 'INVALID_SETUP_DATA' } as T;
    }

    if (nextLanguage === 'es' || nextLanguage === 'en' || nextLanguage === 'pt' || nextLanguage === 'fr') {
      state.language = nextLanguage;
    }
    if (nextTheme === 'auto' || nextTheme === 'light' || nextTheme === 'dark') {
      state.theme = nextTheme;
    }
    if (nextAudioProfile === 'normal' || nextAudioProfile === 'street' || nextAudioProfile === 'vehicle' || nextAudioProfile === 'silent') {
      state.audioProfile = nextAudioProfile;
    }

    state.lockCode = pin;
    state.requiresSetup = false;
    state.mailAccount = {
      id: state.mailAccount?.id || 1,
      alias: mailAlias,
      email: `${mailAlias}@${state.mailDomain}`,
    };

    emitMessage('showPhone', phonePayload());

    return {
      success: true,
      requiresSetup: state.requiresSetup,
      setup: phonePayload().setup,
    } as T;
  }

  if (eventName === 'phoneVerifyPin') {
    const pin = String(payload.pin || '').replace(/\D/g, '').slice(0, 6);
    return {
      success: true,
      unlocked: pin.length >= 4 && pin === state.lockCode,
    } as T;
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

  if (eventName === 'mailGetState') {
    const limit = Math.max(1, Math.min(100, Number(payload.limit || 25) || 25));
    const offset = Math.max(0, Number(payload.offset || 0) || 0);

    const inbox = [...state.mailInbox]
      .sort((a, b) => Number(b.created_at) - Number(a.created_at))
      .slice(offset, offset + limit);
    const sent = [...state.mailSent]
      .sort((a, b) => Number(b.created_at) - Number(a.created_at))
      .slice(offset, offset + limit);

    if (!state.mailAccount) {
      return {
        success: true,
        hasAccount: false,
        account: null,
        inbox: [],
        sent: [],
        unread: 0,
        total: 0,
        domain: state.mailDomain,
      } as T;
    }

    return {
      success: true,
      hasAccount: true,
      account: { ...state.mailAccount },
      inbox,
      sent,
      unread: unreadMailCount(),
      total: state.mailInbox.length + state.mailSent.length,
      domain: state.mailDomain,
    } as T;
  }

  if (eventName === 'mailCreateAccount') {
    if (state.mailAccount) {
      return { success: false, error: 'ACCOUNT_EXISTS' } as T;
    }

    const alias = String(payload.alias || '').trim().toLowerCase();
    const password = String(payload.password || '').trim();
    if (!/^[a-z0-9._-]{3,24}$/.test(alias) || password.length < 4) {
      return { success: false, error: 'INVALID_DATA' } as T;
    }

    const email = `${alias}@${state.mailDomain}`;
    state.mailAccount = {
      id: 1,
      alias,
      email,
    };

    state.mailInbox.unshift({
      id: nextMailMessageId++,
      sender_email: `admin@${state.mailDomain}`,
      sender_alias: 'Admin',
      recipient_email: email,
      recipient_alias: alias,
      subject: 'Cuenta creada',
      body: 'Tu cuenta de mail fue creada con exito en el mock.',
      attachments: [],
      is_read: 0,
      created_at: Date.now(),
    });

    return {
      success: true,
      hasAccount: true,
      account: { ...state.mailAccount },
      domain: state.mailDomain,
    } as T;
  }

  if (eventName === 'mailSend') {
    if (!state.mailAccount) {
      return { success: false, error: 'ACCOUNT_REQUIRED' } as T;
    }

    const to = String(payload.to || '').trim().toLowerCase();
    const subject = String(payload.subject || '').trim();
    const body = String(payload.body || '').trim();
    if (!to || !body) {
      return { success: false, error: 'INVALID_DATA' } as T;
    }

    const attachments = sanitizeMailAttachments(payload.attachments);
    const sentId = nextMailMessageId++;

    state.mailSent.unshift({
      id: sentId,
      sender_email: state.mailAccount.email,
      sender_alias: state.mailAccount.alias,
      recipient_email: to,
      recipient_alias: to.split('@')[0] || undefined,
      subject: subject || undefined,
      body,
      attachments,
      is_read: 1,
      created_at: Date.now(),
    });

    return { success: true, id: sentId } as T;
  }

  if (eventName === 'mailMarkRead') {
    if (!state.mailAccount) {
      return { success: false, error: 'ACCOUNT_REQUIRED' } as T;
    }

    const messageId = Number(payload.messageId || 0);
    if (!messageId || messageId < 1) {
      return { success: false, error: 'INVALID_MESSAGE' } as T;
    }

    let found = false;
    state.mailInbox = state.mailInbox.map((entry) => {
      if (Number(entry.id) !== messageId) return entry;
      found = true;
      if (Number(entry.is_read) === 1) return entry;
      return { ...entry, is_read: 1 };
    });

    return { success: found } as T;
  }

  if (eventName === 'mailGetMessages') {
    if (!state.mailAccount) {
      return { success: false, error: 'ACCOUNT_REQUIRED' } as T;
    }

    const folder = String(payload.folder || 'inbox') === 'sent' ? 'sent' : 'inbox';
    const limit = Math.max(1, Math.min(100, Number(payload.limit || 25) || 25));
    const offset = Math.max(0, Number(payload.offset || 0) || 0);
    const rows = folder === 'sent' ? state.mailSent : state.mailInbox;

    return {
      success: true,
      folder,
      messages: [...rows]
        .sort((a, b) => Number(b.created_at) - Number(a.created_at))
        .slice(offset, offset + limit),
    } as T;
  }

  if (eventName === 'mailDelete') {
    if (!state.mailAccount) {
      return { success: false, error: 'ACCOUNT_REQUIRED' } as T;
    }

    const messageId = Number(payload.messageId || 0);
    const folder = String(payload.folder || 'inbox') === 'sent' ? 'sent' : 'inbox';

    if (!messageId || messageId < 1) {
      return { success: false, error: 'INVALID_MESSAGE' } as T;
    }

    if (folder === 'inbox') {
      state.mailInbox = state.mailInbox.filter((m) => Number(m.id) !== messageId);
    } else {
      state.mailSent = state.mailSent.filter((m) => Number(m.id) !== messageId);
    }

    return { success: true } as T;
  }

  if (eventName === 'setWallpaper') {
    state.wallpaper = String(payload.url || state.wallpaper);
    emitMessage('showPhone', phonePayload());
    return true as T;
  }

  if (eventName === 'setRingtone') {
    state.ringtone = String(payload.ringtone || state.ringtone);
    state.callRingtone = state.ringtone;
    return true as T;
  }

  if (eventName === 'setCallRingtone') {
    state.callRingtone = String(payload.ringtone || state.callRingtone);
    state.ringtone = state.callRingtone;
    return true as T;
  }

  if (eventName === 'setNotificationTone') {
    state.notificationTone = String(payload.tone || state.notificationTone);
    return true as T;
  }

  if (eventName === 'setMessageTone') {
    state.messageTone = String(payload.tone || state.messageTone);
    return true as T;
  }

  if (eventName === 'previewNativeTone') {
    return { success: true, placeholder: true } as T;
  }

  if (eventName === 'stopNativeTonePreview') {
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

  if (eventName === 'factoryResetPhone') {
    resetMockPhoneData();
    return { success: true, ...phonePayload() } as T;
  }

  if (eventName === 'setAirplaneMode') {
    state.airplaneMode = Boolean(payload.enabled);
    return true as T;
  }

  if (eventName === 'phoneSetVisualMode' || eventName === 'setListeningPeerId') {
    return true as T;
  }

  if (eventName === 'cameraGetCapabilities') {
    return {
      flashlight: true,
      advancedCamera: true,
      video: false,
    } as T;
  }

  if (eventName === 'cameraToggleFlashlight') {
    state.flashlightEnabled = Boolean(payload.enabled);
    return { success: true, enabled: state.flashlightEnabled } as T;
  }

  if (eventName === 'cameraGetFlashlightSettings') {
    return {
      enabled: state.flashlightEnabled,
      kelvin: state.flashlightKelvin,
      lumens: state.flashlightLumens,
      minKelvin: 2600,
      maxKelvin: 9000,
      minLumens: 350,
      maxLumens: 2200,
    } as T;
  }

  if (eventName === 'cameraSetFlashlightSettings') {
    const nextKelvin = Number(payload.kelvin ?? state.flashlightKelvin);
    const nextLumens = Number(payload.lumens ?? state.flashlightLumens);
    state.flashlightKelvin = Math.max(2600, Math.min(9000, Number.isFinite(nextKelvin) ? nextKelvin : state.flashlightKelvin));
    state.flashlightLumens = Math.max(350, Math.min(2200, Number.isFinite(nextLumens) ? nextLumens : state.flashlightLumens));
    return {
      success: true,
      kelvin: state.flashlightKelvin,
      lumens: state.flashlightLumens,
    } as T;
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
    const publish = payload.publish !== false;
    const maxDuration = Math.max(30, Number(payload.maxDuration || 300) || 300);
    return await buildLivekitTokenResult(roomName, publish, maxDuration) as T;
  }

  if (eventName === 'socketGetToken') {
    return buildSocketTokenResult() as T;
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
    const rawTab = String(payload.tab || 'forYou');
    const tab: MockChirpTab = rawTab === 'following' || rawTab === 'myActivity' ? rawTab : 'forYou';
    return chirpCloneTweets(tab) as T;
  }

  if (eventName === 'chirpPublishTweet') {
    const content = String(payload.content || '').trim();
    if (!content) {
      return { success: false, error: 'EMPTY_TWEET' } as T;
    }

    const nextId = Math.max(
      ...((Object.values(mockChirpTweetsByTab)
        .flat()
        .map((tweet) => Number(tweet.id) || 0))
      ),
      0,
    ) + 1;

    const row: Record<string, unknown> = {
      id: nextId,
      username: 'mockuser',
      display_name: 'Mock User',
      content,
      media_url: typeof payload.mediaUrl === 'string' ? payload.mediaUrl : undefined,
      likes: 0,
      liked: false,
      rechirps: 0,
      rechirped: false,
      replies: 0,
      is_own: true,
      created_at: nowIso(),
    };

    mockChirpTweetsByTab.myActivity.unshift({ ...row });
    mockChirpTweetsByTab.forYou.unshift({ ...row });
    return { success: true, tweet: row } as T;
  }

  if (eventName === 'chirpToggleLike') {
    const tweetId = Number(payload.tweetId || 0);
    const tweet = findMockChirpTweet(tweetId);
    if (!tweet) return { liked: false, error: 'TWEET_NOT_FOUND' } as T;

    const wasLiked = tweet.liked === true;
    const nextLiked = !wasLiked;
    const likes = Number(tweet.likes || 0) + (nextLiked ? 1 : -1);
    tweet.liked = nextLiked;
    tweet.likes = likes < 0 ? 0 : likes;
    return { liked: nextLiked } as T;
  }

  if (eventName === 'chirpToggleRechirp') {
    const tweetId = Number(payload.tweetId || 0);
    const tweet = findMockChirpTweet(tweetId);
    if (!tweet) return { rechirped: false, error: 'TWEET_NOT_FOUND' } as T;

    const wasRechirped = tweet.rechirped === true;
    const nextRechirped = !wasRechirped;
    const rechirps = Number(tweet.rechirps || 0) + (nextRechirped ? 1 : -1);
    const content = String(payload.content || '').trim();
    tweet.rechirped = nextRechirped;
    tweet.rechirps = rechirps < 0 ? 0 : rechirps;

    if (nextRechirped) {
      const existsInActivity = mockChirpTweetsByTab.myActivity.some((entry) => Number(entry.id) === tweetId && entry.activity_type === 'rechirp');
      if (!existsInActivity) {
        mockChirpTweetsByTab.myActivity.unshift({
          ...tweet,
          activity_type: 'rechirp',
          activity_created_at: nowIso(),
          activity_actor_display_name: 'Mock User',
          activity_actor_username: 'mockuser',
          original_tweet_id: Number(tweet.id),
          original_content: String(tweet.content || ''),
          original_media_url: typeof tweet.media_url === 'string' ? tweet.media_url : undefined,
          original_username: String(tweet.username || 'user'),
          original_display_name: String(tweet.display_name || 'Usuario'),
          rechirp_comment: content || undefined,
        });
      }
    } else {
      mockChirpTweetsByTab.myActivity = mockChirpTweetsByTab.myActivity.filter((entry) => !(Number(entry.id) === tweetId && entry.activity_type === 'rechirp'));
    }

    return { rechirped: nextRechirped } as T;
  }

  if (eventName === 'chirpGetComments') {
    const tweetId = Number(payload.tweetId || 0);
    return [...(mockChirpCommentsByTweet[tweetId] || [])] as T;
  }

  if (eventName === 'chirpAddComment') {
    const tweetId = Number(payload.tweetId || 0);
    const content = String(payload.content || '').trim();
    if (!tweetId || !content) {
      return { success: false, error: 'INVALID_COMMENT' } as T;
    }

    const tweet = findMockChirpTweet(tweetId);
    if (!tweet) {
      return { success: false, error: 'TWEET_NOT_FOUND' } as T;
    }

    const row: Record<string, unknown> = {
      id: nextChirpCommentId++,
      tweet_id: tweetId,
      username: 'mockuser',
      display_name: 'Mock User',
      content,
      created_at: nowIso(),
    };
    if (!mockChirpCommentsByTweet[tweetId]) {
      mockChirpCommentsByTweet[tweetId] = [];
    }
    mockChirpCommentsByTweet[tweetId].push(row);
    tweet.replies = Number(tweet.replies || 0) + 1;
    return { success: true, comment: row } as T;
  }

  if (eventName === 'chirpDeleteTweet') {
    const tweetId = Number(payload.tweetId || 0);
    const tabs = Object.keys(mockChirpTweetsByTab) as MockChirpTab[];
    for (const tab of tabs) {
      mockChirpTweetsByTab[tab] = mockChirpTweetsByTab[tab].filter((tweet) => Number(tweet.id) !== tweetId);
    }
    delete mockChirpCommentsByTweet[tweetId];
    return { success: true } as T;
  }

  if (eventName === 'snapGetAccount') {
    return { id: 1, username: 'snapper', display_name: 'Snap User' } as T;
  }

  if (eventName === 'snapGetDiscoverAccounts') {
    return mockSnapDiscoverAccounts.map((entry) => ({
      ...entry,
      is_following: mockSnapFollowing.has(entry.account_id) ? 1 : 0,
      requested_by_me: mockSnapSentRequests.has(entry.account_id) ? 1 : 0,
    })) as T;
  }

  if (eventName === 'snapGetDiscoverFeed') {
    const search = String(payload.search || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(100, Number(payload.limit || 30) || 30));
    const offset = Math.max(0, Number(payload.offset || 0) || 0);

    const rows = mockSnapDiscoverPosts
      .filter((row) => {
        if (!search) return true;
        const account = mockSnapDiscoverAccounts.find((entry) => entry.account_id === row.account_id);
        const haystack = [
          row.username,
          row.display_name,
          row.caption,
          account?.bio,
        ]
          .map((value) => String(value || '').toLowerCase())
          .join(' ');
        return haystack.includes(search);
      })
      .slice(offset, offset + limit)
      .map((row) => ({
        ...row,
        is_following: mockSnapFollowing.has(row.account_id) ? 1 : 0,
        requested_by_me: mockSnapSentRequests.has(row.account_id) ? 1 : 0,
      }));

    return rows as T;
  }

  if (eventName === 'snapFollow') {
    const targetAccountId = Number(payload.targetAccountId || 0);
    const target = mockSnapDiscoverAccounts.find((entry) => entry.account_id === targetAccountId);
    if (!target) {
      return { error: 'ACCOUNT_NOT_FOUND' } as T;
    }

    if (mockSnapFollowing.has(targetAccountId)) {
      return { error: 'ALREADY_FOLLOWING' } as T;
    }

    if (Number(target.is_private) === 1) {
      if (mockSnapSentRequests.has(targetAccountId)) {
        mockSnapSentRequests.delete(targetAccountId);
        return { success: true, cancelled: true } as T;
      }

      mockSnapSentRequests.add(targetAccountId);
      return { success: true, requested: true } as T;
    }

    mockSnapFollowing.add(targetAccountId);
    return { success: true, following: true } as T;
  }

  if (eventName === 'snapGetPendingFollowRequests') {
    return [...mockSnapPendingRequests] as T;
  }

  if (eventName === 'snapGetSentFollowRequests') {
    const rows = [...mockSnapSentRequests]
      .map((accountId) => {
        const target = mockSnapDiscoverAccounts.find((entry) => entry.account_id === accountId);
        if (!target) return null;
        return {
          id: accountId,
          account_id: target.account_id,
          username: target.username,
          display_name: target.display_name,
          avatar: target.avatar,
          is_private: target.is_private,
          created_at: nowIso(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
    return rows as T;
  }

  if (eventName === 'snapRespondFollowRequest') {
    const requestId = Number(payload.requestId || 0);
    const action = String(payload.action || 'reject');
    const index = mockSnapPendingRequests.findIndex((entry) => entry.id === requestId);
    if (index < 0) return { success: false, error: 'REQUEST_NOT_FOUND' } as T;

    const row = mockSnapPendingRequests[index];
    mockSnapPendingRequests.splice(index, 1);
    if (action === 'accept') {
      mockSnapFollowing.add(Number(row.account_id));
      return { success: true, accepted: true } as T;
    }

    return { success: true, rejected: true } as T;
  }

  if (eventName === 'snapCancelFollowRequest') {
    const requestId = Number(payload.requestId || 0);
    mockSnapSentRequests.delete(requestId);
    return { success: true, cancelled: true } as T;
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

  if (eventName === 'yellowpagesGetCategories') {
    return [...mockYellowCategories] as T;
  }

  if (eventName === 'yellowpagesGetListings') {
    const limit = Math.max(1, Math.min(50, Number(payload.limit || 20) || 20));
    const offset = Math.max(0, Number(payload.offset || 0) || 0);
    const category = String(payload.category || 'all').trim().toLowerCase();
    const search = String(payload.search || '').trim().toLowerCase();

    const filtered = mockYellowListings.filter((row) => {
      if (category && category !== 'all' && row.category !== category) return false;
      if (!search) return true;
      const haystack = `${row.title} ${row.description} ${row.seller_name}`.toLowerCase();
      return haystack.includes(search);
    });

    return filtered
      .slice(offset, offset + limit)
      .map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        price: row.price,
        category: row.category,
        photos: [...row.photos],
        views: row.views,
        created_at: row.created_at,
        is_own: row.seller_identifier === 'mock:self' ? 1 : 0,
      })) as T;
  }

  if (eventName === 'yellowpagesGetMyListings') {
    return mockYellowListings
      .filter((row) => row.seller_identifier === 'mock:self')
      .map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        price: row.price,
        category: row.category,
        photos: [...row.photos],
        views: row.views,
        created_at: row.created_at,
        is_own: 1,
      })) as T;
  }

  if (eventName === 'yellowpagesGetSellerInfo') {
    const listingIdRaw = typeof payload === 'number' ? payload : payload.listingId;
    const listingId = Number(listingIdRaw || 0);
    const listing = mockYellowListings.find((row) => row.id === listingId);
    if (!listing) {
      return null as T;
    }

    return {
      identifier: listing.seller_identifier,
      phone_number: listing.seller_phone || '555-0000',
      seller_name: listing.seller_name,
      seller_avatar: listing.seller_avatar,
      location_shared: false,
      location_x: null,
      location_y: null,
      location_z: null,
    } as T;
  }

  if (eventName === 'yellowpagesRecordContact') {
    return { success: true } as T;
  }

  if (eventName === 'yellowpagesCreateListing') {
    const title = String(payload.title || '').trim();
    const description = String(payload.description || '').trim();
    const price = Math.max(0, Number(payload.price || 0) || 0);
    const category = String(payload.category || 'other').trim().toLowerCase();
    const validCategory = mockYellowCategories.some((row) => row.id === category)
      ? category
      : 'other';
    const photos = Array.isArray(payload.photos)
      ? payload.photos.filter((url): url is string => typeof url === 'string' && url.trim().length > 0).slice(0, 5)
      : [];

    if (title.length < 3 || description.length < 5) {
      return { success: false, error: 'INVALID_LISTING' } as T;
    }

    const listing = {
      id: nextYellowListingId++,
      title,
      description,
      price,
      category: validCategory,
      photos,
      views: 0,
      created_at: nowIso(),
      seller_identifier: 'mock:self',
      seller_name: 'Mock User',
      seller_avatar: './img/background/back001.jpg',
      seller_phone: state.phoneNumber,
    };

    mockYellowListings.unshift(listing);
    return {
      success: true,
      listing: {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        price: listing.price,
        category: listing.category,
        photos: [...listing.photos],
        views: listing.views,
        created_at: listing.created_at,
        is_own: 1,
      },
    } as T;
  }

  if (eventName === 'yellowpagesDeleteListing') {
    const listingIdRaw = typeof payload === 'number' ? payload : payload.listingId;
    const listingId = Number(listingIdRaw || 0);
    const index = mockYellowListings.findIndex(
      (row) => row.id === listingId && row.seller_identifier === 'mock:self',
    );
    if (index < 0) {
      return { success: false, error: 'LISTING_NOT_FOUND' } as T;
    }

    mockYellowListings.splice(index, 1);
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
    const requestedCategory = String(payload?.category || 'all');
    const rows = requestedCategory === 'all'
      ? mockNewsArticles
      : mockNewsArticles.filter((entry) => String(entry.category || 'general') === requestedCategory);
    return [...rows].sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || ''))) as T;
  }

  if (eventName === 'newsPublishArticle') {
    mockNewsArticles.unshift({
      id: nextMockNewsId++,
      author_name: 'Mock Newsroom',
      title: String(payload.title || 'Nueva noticia'),
      content: String(payload.content || ''),
      category: String(payload.category || 'general'),
      media_url: String(payload.mediaUrl || ''),
      created_at: nowIso(),
      is_live: 0,
      live_viewers: 0,
    });
    emitMessage('gcphone:news:newArticle', { success: true });
    return { success: true } as T;
  }

  if (eventName === 'newsGetCategories') {
    return ['general', 'trafico', 'policial'] as T;
  }

  if (eventName === 'newsDeleteArticle' || eventName === 'newsViewArticle') {
    if (eventName === 'newsDeleteArticle') {
      const articleId = Number(payload?.articleId || 0);
      const index = mockNewsArticles.findIndex((entry) => Number(entry.id || 0) === articleId);
      if (index >= 0) mockNewsArticles.splice(index, 1);
    }
    return { success: true } as T;
  }

  if (eventName === 'newsGetLiveNews') {
    return mockNewsArticles.filter((entry) => Number(entry.is_live || 0) === 1) as T;
  }

  if (eventName === 'newsGetScaleform') {
    const articleId = Number(payload?.articleId || 0);
    return (mockNewsScaleforms.get(articleId) || null) as T;
  }

  if (eventName === 'newsJoinLive') {
    const articleId = Number(payload?.articleId || 0);
    const article = mockNewsArticles.find((entry) => Number(entry.id || 0) === articleId && Number(entry.is_live || 0) === 1);
    if (!article) {
      return { success: false, error: 'LIVE_UNAVAILABLE' } as T;
    }
    if (!mockJoinedNewsLives.has(articleId)) {
      mockJoinedNewsLives.add(articleId);
      article.live_viewers = Math.max(0, Number(article.live_viewers || 0)) + 1;
      emitMessage('gcphone:news:viewersUpdated', { articleId, viewers: article.live_viewers });
    }
    return { success: true, articleId, viewers: Number(article.live_viewers || 0), messages: mockNewsLiveMessages.get(articleId) || [] } as T;
  }

  if (eventName === 'newsLeaveLive') {
    const articleId = Number(payload?.articleId || 0);
    if (articleId > 0) {
      const article = mockNewsArticles.find((entry) => Number(entry.id || 0) === articleId);
      if (article && mockJoinedNewsLives.has(articleId)) {
        mockJoinedNewsLives.delete(articleId);
        article.live_viewers = Math.max(0, Number(article.live_viewers || 0) - 1);
        emitMessage('gcphone:news:viewersUpdated', { articleId, viewers: article.live_viewers });
      }
      return { success: true } as T;
    }

    for (const joinedId of Array.from(mockJoinedNewsLives)) {
      const article = mockNewsArticles.find((entry) => Number(entry.id || 0) === joinedId);
      if (article) {
        article.live_viewers = Math.max(0, Number(article.live_viewers || 0) - 1);
        emitMessage('gcphone:news:viewersUpdated', { articleId: joinedId, viewers: article.live_viewers });
      }
      mockJoinedNewsLives.delete(joinedId);
    }

    return { success: true } as T;
  }

  if (eventName === 'newsSendLiveMessage') {
    const articleId = Number(payload?.articleId || 0);
    const article = mockNewsArticles.find((entry) => Number(entry.id || 0) === articleId && Number(entry.is_live || 0) === 1);
    if (!article) {
      return { success: false, error: 'LIVE_UNAVAILABLE' } as T;
    }

    const current = mockNewsLiveMessages.get(articleId) || [];
    const message = {
      id: `${articleId}:${Date.now()}`,
      authorId: 'mocknews',
      username: 'mocknews',
      display: 'Mock Newsroom',
      content: String(payload?.content || '').trim(),
      createdAt: Date.now(),
    };
    mockNewsLiveMessages.set(articleId, [...current.slice(-19), message]);
    emitMessage('gcphone:news:liveMessage', { articleId, message });
    return { success: true, message } as T;
  }

  if (eventName === 'newsSendLiveReaction') {
    const articleId = Number(payload?.articleId || 0);
    const article = mockNewsArticles.find((entry) => Number(entry.id || 0) === articleId && Number(entry.is_live || 0) === 1);
    if (!article) {
      return { success: false, error: 'LIVE_UNAVAILABLE' } as T;
    }

    const reaction = {
      id: `${articleId}:${Date.now()}`,
      reaction: String(payload?.reaction || '🔥').trim(),
      username: 'mocknews',
      createdAt: Date.now(),
    };
    emitMessage('gcphone:news:liveReaction', { articleId, reaction });
    return { success: true, reaction } as T;
  }

  if (eventName === 'newsRemoveLiveMessage') {
    const articleId = Number(payload?.articleId || 0);
    const messageId = String(payload?.messageId || '');
    const current = mockNewsLiveMessages.get(articleId) || [];
    mockNewsLiveMessages.set(articleId, current.filter((entry) => entry.id !== messageId));
    emitMessage('gcphone:news:liveMessageRemoved', { articleId, messageId });
    return { success: true } as T;
  }

  if (eventName === 'newsMuteLiveUser') {
    const articleId = Number(payload?.articleId || 0);
    const username = String(payload?.username || '').trim();
    const targetIdentifier = String(payload?.targetIdentifier || '').trim();
    if (!mockMutedNewsUsers.has(articleId)) {
      mockMutedNewsUsers.set(articleId, new Set());
    }
    mockMutedNewsUsers.get(articleId)!.add(targetIdentifier);
    emitMessage('gcphone:news:liveUserMuted', { articleId, username });
    return { success: true } as T;
  }

  if (eventName === 'newsStartLive') {
    const articleId = nextMockNewsId++;
    const scaleform = (payload?.scaleform as Record<string, unknown> | undefined) || {};
    const article = {
      id: articleId,
      author_name: 'Mock Newsroom',
      title: String(payload.title || 'Transmision en vivo'),
      content: String(payload.content || 'Cobertura en vivo'),
      category: String(payload.category || 'general'),
      media_url: './img/background/back001.jpg',
      created_at: nowIso(),
      is_live: 1,
      live_viewers: 1,
    };
    mockNewsArticles.unshift(article);
    mockNewsLiveMessages.set(articleId, []);
    mockMutedNewsUsers.set(articleId, new Set());
    mockNewsScaleforms.set(articleId, {
      preset: String(scaleform.preset || 'breaking'),
      headline: String(scaleform.headline || 'ULTIMO MOMENTO'),
      subtitle: String(scaleform.subtitle || 'Cobertura en vivo'),
      ticker: String(scaleform.ticker || 'Desarrollo en curso...'),
    });
    emitMessage('gcphone:news:liveStarted', article);
    return { success: true, articleId } as T;
  }

  if (eventName === 'newsSetScaleform') {
    const articleId = Number(payload?.articleId || 0);
    const scaleform = (payload?.scaleform as Record<string, unknown> | undefined) || {};
    if (articleId > 0) {
      mockNewsScaleforms.set(articleId, {
        preset: String(scaleform.preset || 'breaking'),
        headline: String(scaleform.headline || 'ULTIMO MOMENTO'),
        subtitle: String(scaleform.subtitle || 'Cobertura en vivo'),
        ticker: String(scaleform.ticker || 'Desarrollo en curso...'),
      });
      emitMessage('gcphone:news:scaleformUpdated', { articleId, scaleform: mockNewsScaleforms.get(articleId) });
    }
    return { success: true } as T;
  }

  if (eventName === 'newsEndLive') {
    const articleId = Number(payload?.articleId || 0);
    const article = mockNewsArticles.find((entry) => Number(entry.id || 0) === articleId);
    if (article) {
      article.is_live = 0;
      article.live_viewers = 0;
    }
    mockJoinedNewsLives.delete(articleId);
    mockNewsScaleforms.delete(articleId);
    mockNewsLiveMessages.delete(articleId);
    mockMutedNewsUsers.delete(articleId);
    emitMessage('gcphone:news:liveEnded', articleId);
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

  if (eventName === 'walletProximityTransfer') {
    return { success: true, balance: Math.max(0, state.balance - Number(payload.amount || 0)) } as T;
  }

  if (eventName === 'walletCreateRequest') {
    const targetPhone = String(payload.targetPhone || '').trim();
    const amount = Number(payload.amount || 0);
    if (!targetPhone || !Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: 'INVALID_REQUEST' } as T;
    }

    const row = {
      id: nextWalletRequestId++,
      requesterIdentifier: 'mock:self',
      requesterPhone: state.phoneNumber,
      targetIdentifier: `mock:${targetPhone}`,
      targetPhone,
      amount,
      title: String(payload.title || 'Solicitud QR/NFC').slice(0, 64),
      method: String(payload.method || 'qr') === 'nfc' ? 'nfc' as const : 'qr' as const,
      status: 'pending' as const,
      expiresAt: nowIso(),
      createdAt: nowIso(),
    };
    mockWalletRequests.unshift(row);
    return { success: true, request: row } as T;
  }

  if (eventName === 'walletGetPendingRequests') {
    if (!mockWalletRequests.some((item) => item.targetPhone === state.phoneNumber && item.status === 'pending')) {
      mockWalletRequests.unshift({
        id: nextWalletRequestId++,
        requesterIdentifier: 'mock:remote',
        requesterPhone: '555-1111',
        targetIdentifier: 'mock:self',
        targetPhone: state.phoneNumber,
        amount: 125,
        title: 'Solicitud pendiente',
        method: 'qr',
        status: 'pending',
        expiresAt: nowIso(),
        createdAt: nowIso(),
      });
    }
    return {
      incoming: mockWalletRequests.filter((item) => item.targetPhone === state.phoneNumber && item.status === 'pending'),
      outgoing: mockWalletRequests.filter((item) => item.requesterPhone === state.phoneNumber && item.status === 'pending'),
    } as T;
  }

  if (eventName === 'walletRespondRequest') {
    const requestId = Number(payload.requestId || 0);
    const accept = payload.accept === true;
    const row = mockWalletRequests.find((item) => item.id === requestId);
    if (!row || row.status !== 'pending') {
      return { success: false, error: 'REQUEST_NOT_FOUND' } as T;
    }
    row.status = accept ? 'accepted' : 'declined';
    return { success: true, status: row.status, balance: state.balance } as T;
  }

  if (eventName === 'securityGetBlockedNumbers') {
    return [...mockBlockedNumbers] as T;
  }

  if (eventName === 'securityBlockNumber') {
    const targetPhone = String(payload.targetPhone || '').trim();
    if (!targetPhone) return { success: false, error: 'INVALID_PHONE' } as T;
    const existing = mockBlockedNumbers.find((entry) => entry.target_phone === targetPhone);
    if (!existing) {
      mockBlockedNumbers.unshift({
        id: mockBlockedNumbers.length + 1,
        target_phone: targetPhone,
        reason: typeof payload.reason === 'string' ? payload.reason : undefined,
        created_at: nowIso(),
      });
    }
    return { success: true } as T;
  }

  if (eventName === 'securityUnblockNumber') {
    const targetPhone = String(payload.targetPhone || '').trim();
    const index = mockBlockedNumbers.findIndex((entry) => entry.target_phone === targetPhone);
    if (index >= 0) mockBlockedNumbers.splice(index, 1);
    return { success: true } as T;
  }

  if (eventName === 'securityReportUser') {
    return { success: true } as T;
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

  if (eventName === 'getPlayerCoords') {
    return { x: -268.42, y: -956.31 } as T;
  }

  if (eventName === 'setLiveLocationInterval') {
    const seconds = Number(payload.seconds);
    mockLiveLocationInterval = seconds <= 5 ? 5 : 10;
    return { success: true, intervalSeconds: mockLiveLocationInterval } as T;
  }

  if (eventName === 'getLiveLocationState') {
    return { success: true, active: mockLiveLocationActive, intervalSeconds: mockLiveLocationInterval } as T;
  }

  if (eventName === 'startLiveLocation') {
    mockLiveLocationActive = true;
    return { success: true } as T;
  }

  if (eventName === 'stopLiveLocation') {
    mockLiveLocationActive = false;
    return { success: true } as T;
  }

  if (eventName === 'getActiveLiveLocations') {
    if (!mockLiveLocationActive) {
      return { success: true, locations: [] } as T;
    }

    return {
      success: true,
      locations: [
        { sender_phone: '555-1111', sender_name: 'Maria Garcia', x: -112.15, y: -1054.2 },
        { sender_phone: '555-3333', sender_name: 'Ana Lopez', x: 241.02, y: -833.48 },
      ],
    } as T;
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
