import { io, type Socket } from 'socket.io-client';

export interface WaveSocketMessage {
  id: number | string;
  roomId: string;
  senderPhone: string;
  senderName: string;
  content: string;
  mediaUrl?: string;
  createdAt: number;
}

type AckPayload = { success?: boolean; error?: string; message?: WaveSocketMessage; messages?: WaveSocketMessage[] };
let socket: Socket | null = null;
let currentToken: string | null = null;
let currentHost: string | null = null;
let currentHandlers: {
  onMessage?: (message: WaveSocketMessage) => void;
  onTyping?: (payload: { roomId: string; phone: string; typing: boolean }) => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
  onReconnectFailed?: () => void;
} | null = null;

export interface SnapLiveSocketMessage {
  id: string;
  liveId: string;
  authorId?: string;
  username: string;
  display?: string;
  avatar?: string;
  content: string;
  isMention: boolean;
  createdAt: number;
}

export interface SnapLiveReaction {
  id: string;
  liveId: string;
  username: string;
  avatar?: string;
  reaction: string;
  createdAt: number;
}

type SnapLiveAck = { success?: boolean; error?: string };
type SnapLiveJoinAck = { success?: boolean; error?: string; viewers?: number; messages?: SnapLiveSocketMessage[] };

let liveSocket: Socket | null = null;
let liveCurrentHandlers: {
  onMessage?: (message: SnapLiveSocketMessage) => void;
  onReaction?: (payload: SnapLiveReaction) => void;
  onViewersUpdated?: (payload: { liveId: string; viewers: number }) => void;
  onMessageDeleted?: (payload: { liveId: string; messageId: string }) => void;
  onUserMuted?: (payload: { liveId: string; username: string }) => void;
  onUserUnmuted?: (payload: { liveId: string; username: string }) => void;
  onUserKicked?: (payload: { liveId: string; username: string }) => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
  onReconnectFailed?: () => void;
} | null = null;
export function disconnectWaveSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentToken = null;
  currentHost = null;
  currentHandlers = null;
}
export function connectWaveSocket(host: string, token: string, handlers?: {
  onMessage?: (message: WaveSocketMessage) => void;
  onTyping?: (payload: { roomId: string; phone: string; typing: boolean }) => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
  onReconnectFailed?: () => void;
}) {
  disconnectWaveSocket();
  currentHost = host;
  currentToken = token;
  currentHandlers = handlers || null;
  socket = io(host, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
  });
  if (handlers?.onMessage) {
    socket.on('wavechat:message', handlers.onMessage);
  }
  if (handlers?.onTyping) {
    socket.on('wavechat:typing', handlers.onTyping);
  }
  if (handlers?.onDisconnect) {
    socket.on('disconnect', handlers.onDisconnect);
  }
  socket.io.on('reconnect', () => {
    currentHandlers?.onReconnect?.();
  });
  socket.io.on('reconnect_failed', () => {
    currentHandlers?.onReconnectFailed?.();
  });
  socket.on('connect_error', (error) => {
    if (error.message === 'INVALID_TOKEN' || error.message === 'TOKEN_EXPIRED') {
      currentHandlers?.onReconnectFailed?.();
    }
  });
  return socket
}
export function isWaveSocketConnected() {
  return Boolean(socket && socket.connected);
}
export function joinWaveRoom(roomId: string) {
  socket?.emit('wavechat:joinRoom', { roomId });
}
export function leaveWaveRoom(roomId: string) {
  socket?.emit('wavechat:leaveRoom', { roomId });
}
export function sendWaveTyping(roomId: string, typing: boolean) {
  socket?.emit('wavechat:typing', { roomId, typing });
}
export function getWaveRecent(roomId: string, limit = 100): Promise<AckPayload> {
  return new Promise<AckPayload>((resolve) => {
    socket?.emit('wavechat:getRecent', { roomId, limit }, (payload: AckPayload) => {
      resolve(payload || { success: false, messages: [] });
    });
  });
}
export function sendWaveMessage(roomId: string, content: string, mediaUrl?: string): Promise<AckPayload> {
  return new Promise<AckPayload>((resolve) => {
    socket?.emit('wavechat:send', { roomId, content, mediaUrl }, (payload: AckPayload) => {
      resolve(payload || { success: false });
    });
  });
}

export function disconnectSnapLiveSocket() {
  if (liveSocket) {
    liveSocket.disconnect();
    liveSocket = null;
  }
  liveCurrentHandlers = null;
}

export function connectSnapLiveSocket(host: string, token: string, handlers?: {
  onMessage?: (message: SnapLiveSocketMessage) => void;
  onReaction?: (payload: SnapLiveReaction) => void;
  onViewersUpdated?: (payload: { liveId: string; viewers: number }) => void;
  onMessageDeleted?: (payload: { liveId: string; messageId: string }) => void;
  onUserMuted?: (payload: { liveId: string; username: string }) => void;
  onUserUnmuted?: (payload: { liveId: string; username: string }) => void;
  onUserKicked?: (payload: { liveId: string; username: string }) => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
  onReconnectFailed?: () => void;
}) {
  disconnectSnapLiveSocket();
  liveCurrentHandlers = handlers || null;
  liveSocket = io(host, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
  });

  if (handlers?.onMessage) {
    liveSocket.on('snaplive:message', handlers.onMessage);
  }
  if (handlers?.onReaction) {
    liveSocket.on('snaplive:reaction', handlers.onReaction);
  }
  if (handlers?.onViewersUpdated) {
    liveSocket.on('snaplive:viewersUpdated', handlers.onViewersUpdated);
  }
  if (handlers?.onMessageDeleted) {
    liveSocket.on('snaplive:messageDeleted', handlers.onMessageDeleted);
  }
  if (handlers?.onUserMuted) {
    liveSocket.on('snaplive:userMuted', handlers.onUserMuted);
  }
  if (handlers?.onUserUnmuted) {
    liveSocket.on('snaplive:userUnmuted', handlers.onUserUnmuted);
  }
  if (handlers?.onUserKicked) {
    liveSocket.on('snaplive:userKicked', handlers.onUserKicked);
  }
  if (handlers?.onDisconnect) {
    liveSocket.on('disconnect', handlers.onDisconnect);
  }

  liveSocket.io.on('reconnect', () => {
    liveCurrentHandlers?.onReconnect?.();
  });
  liveSocket.io.on('reconnect_failed', () => {
    liveCurrentHandlers?.onReconnectFailed?.();
  });
  liveSocket.on('connect_error', (error) => {
    if (error.message === 'INVALID_TOKEN' || error.message === 'TOKEN_EXPIRED') {
      liveCurrentHandlers?.onReconnectFailed?.();
    }
  });

  return liveSocket;
}

export function isSnapLiveSocketConnected() {
  return Boolean(liveSocket && liveSocket.connected);
}

function normalizeLiveId(liveId: string): string | null {
  const normalized = String(liveId ?? '').trim();
  if (!/^\d+$/.test(normalized)) return null;
  return normalized;
}

function normalizeText(value: string, maxLength: number): string | null {
  const normalized = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    return normalized.slice(0, maxLength);
  }
  return normalized;
}

function normalizeToken(value: string, maxLength: number, pattern: RegExp): string | null {
  const normalized = normalizeText(value, maxLength);
  if (!normalized) return null;
  if (!pattern.test(normalized)) return null;
  return normalized;
}

export function joinSnapLiveRoom(liveId: string): Promise<SnapLiveJoinAck> {
  return new Promise<SnapLiveJoinAck>((resolve) => {
    if (!liveSocket || !liveSocket.connected) {
      resolve({ success: false, error: 'SOCKET_OFFLINE', messages: [] });
      return;
    }

    const safeLiveId = normalizeLiveId(liveId);
    if (!safeLiveId) {
      resolve({ success: false, error: 'INVALID_PAYLOAD', messages: [] });
      return;
    }

    liveSocket.emit('snaplive:joinRoom', { liveId: safeLiveId }, (payload: SnapLiveJoinAck) => {
      resolve(payload || { success: false, messages: [] });
    });
  });
}

export function leaveSnapLiveRoom(liveId: string) {
  const safeLiveId = normalizeLiveId(liveId);
  if (!safeLiveId) return;
  liveSocket?.emit('snaplive:leaveRoom', { liveId: safeLiveId });
}

export function sendSnapLiveMessage(liveId: string, content: string): Promise<SnapLiveAck> {
  return new Promise<SnapLiveAck>((resolve) => {
    if (!liveSocket || !liveSocket.connected) {
      resolve({ success: false, error: 'SOCKET_OFFLINE' });
      return;
    }

    const safeLiveId = normalizeLiveId(liveId);
    const safeContent = normalizeText(content, 400);
    if (!safeLiveId || !safeContent) {
      resolve({ success: false, error: 'INVALID_PAYLOAD' });
      return;
    }

    liveSocket?.emit('snaplive:send', { liveId: safeLiveId, content: safeContent }, (payload: SnapLiveAck) => {
      resolve(payload || { success: false });
    });
  });
}

export function sendSnapLiveReaction(liveId: string, reaction: string): Promise<SnapLiveAck> {
  return new Promise<SnapLiveAck>((resolve) => {
    if (!liveSocket || !liveSocket.connected) {
      resolve({ success: false, error: 'SOCKET_OFFLINE' });
      return;
    }

    const safeLiveId = normalizeLiveId(liveId);
    const safeReaction = normalizeText(reaction, 24);
    if (!safeLiveId || !safeReaction) {
      resolve({ success: false, error: 'INVALID_PAYLOAD' });
      return;
    }

    liveSocket?.emit('snaplive:reaction', { liveId: safeLiveId, reaction: safeReaction }, (payload: SnapLiveAck) => {
      resolve(payload || { success: false });
    });
  });
}

export function deleteSnapLiveMessage(liveId: string, messageId: string): Promise<SnapLiveAck> {
  return new Promise<SnapLiveAck>((resolve) => {
    if (!liveSocket || !liveSocket.connected) {
      resolve({ success: false, error: 'SOCKET_OFFLINE' });
      return;
    }

    const safeLiveId = normalizeLiveId(liveId);
    const safeMessageId = normalizeToken(messageId, 64, /^[a-zA-Z0-9._:-]+$/);
    if (!safeLiveId || !safeMessageId) {
      resolve({ success: false, error: 'INVALID_PAYLOAD' });
      return;
    }

    liveSocket?.emit('snaplive:deleteMessage', { liveId: safeLiveId, messageId: safeMessageId }, (payload: SnapLiveAck) => {
      resolve(payload || { success: false });
    });
  });
}

export function muteSnapLiveUser(liveId: string, username: string): Promise<SnapLiveAck> {
  return new Promise<SnapLiveAck>((resolve) => {
    if (!liveSocket || !liveSocket.connected) {
      resolve({ success: false, error: 'SOCKET_OFFLINE' });
      return;
    }

    const safeLiveId = normalizeLiveId(liveId);
    const safeUsername = normalizeToken(username, 32, /^[a-zA-Z0-9._-]+$/);
    if (!safeLiveId || !safeUsername) {
      resolve({ success: false, error: 'INVALID_PAYLOAD' });
      return;
    }

    liveSocket?.emit('snaplive:muteUser', { liveId: safeLiveId, username: safeUsername }, (payload: SnapLiveAck) => {
      resolve(payload || { success: false });
    });
  });
}

// ── MatchMyLove Chat Socket ──

export interface MmlSocketMessage {
  id: string;
  matchId: number;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: number;
}

type MmlAck = { success?: boolean; error?: string; message?: MmlSocketMessage };
type MmlJoinAck = { success?: boolean; error?: string; messages?: MmlSocketMessage[] };

let mmlSocket: Socket | null = null;
let mmlCurrentHandlers: {
  onMessage?: (message: MmlSocketMessage) => void;
  onTyping?: (payload: { matchId: number; identifier: string; name: string; typing: boolean }) => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
} | null = null;

export function disconnectMmlSocket() {
  if (mmlSocket) {
    mmlSocket.disconnect();
    mmlSocket = null;
  }
  mmlCurrentHandlers = null;
}

export function connectMmlSocket(host: string, token: string, handlers?: {
  onMessage?: (message: MmlSocketMessage) => void;
  onTyping?: (payload: { matchId: number; identifier: string; name: string; typing: boolean }) => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
}) {
  disconnectMmlSocket();
  mmlCurrentHandlers = handlers || null;
  mmlSocket = io(host, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
  });

  if (handlers?.onMessage) {
    mmlSocket.on('matchmylove:message', handlers.onMessage);
  }
  if (handlers?.onTyping) {
    mmlSocket.on('matchmylove:typing', handlers.onTyping);
  }
  if (handlers?.onDisconnect) {
    mmlSocket.on('disconnect', handlers.onDisconnect);
  }
  mmlSocket.io.on('reconnect', () => {
    mmlCurrentHandlers?.onReconnect?.();
  });
  mmlSocket.on('connect_error', (error) => {
    if (error.message === 'INVALID_TOKEN' || error.message === 'TOKEN_EXPIRED') {
      disconnectMmlSocket();
    }
  });

  return mmlSocket;
}

export function isMmlSocketConnected() {
  return Boolean(mmlSocket && mmlSocket.connected);
}

export function joinMmlRoom(matchId: number): Promise<MmlJoinAck> {
  return new Promise<MmlJoinAck>((resolve) => {
    if (!mmlSocket || !mmlSocket.connected) {
      resolve({ success: false, error: 'SOCKET_OFFLINE', messages: [] });
      return;
    }
    mmlSocket.emit('matchmylove:joinRoom', { matchId }, (payload: MmlJoinAck) => {
      resolve(payload || { success: false, messages: [] });
    });
  });
}

export function leaveMmlRoom(matchId: number) {
  mmlSocket?.emit('matchmylove:leaveRoom', { matchId });
}

export function sendMmlMessage(matchId: number, content: string): Promise<MmlAck> {
  return new Promise<MmlAck>((resolve) => {
    if (!mmlSocket || !mmlSocket.connected) {
      resolve({ success: false, error: 'SOCKET_OFFLINE' });
      return;
    }
    const safe = String(content || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 500);
    if (!safe) {
      resolve({ success: false, error: 'EMPTY_MESSAGE' });
      return;
    }
    mmlSocket.emit('matchmylove:send', { matchId, content: safe }, (payload: MmlAck) => {
      resolve(payload || { success: false });
    });
  });
}

export function sendMmlTyping(matchId: number, typing: boolean) {
  mmlSocket?.emit('matchmylove:typing', { matchId, typing });
}
