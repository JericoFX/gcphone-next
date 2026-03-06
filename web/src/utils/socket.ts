import { io, type Socket } from 'socket.io-client';

export interface WaveSocketMessage {
  id: number | string;
  roomId: string;
  senderPhone: string;
  senderName: string;
  content: string;
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
  username: string;
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

let liveSocket: Socket | null = null;
let liveCurrentHandlers: {
  onMessage?: (message: SnapLiveSocketMessage) => void;
  onReaction?: (payload: SnapLiveReaction) => void;
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
export function sendWaveMessage(roomId: string, content: string): Promise<AckPayload> {
  return new Promise<AckPayload>((resolve) => {
    socket?.emit('wavechat:send', { roomId, content }, (payload: AckPayload) => {
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

export function joinSnapLiveRoom(liveId: string) {
  liveSocket?.emit('snaplive:joinRoom', { liveId });
}

export function leaveSnapLiveRoom(liveId: string) {
  liveSocket?.emit('snaplive:leaveRoom', { liveId });
}

export function sendSnapLiveMessage(liveId: string, content: string): Promise<SnapLiveAck> {
  return new Promise<SnapLiveAck>((resolve) => {
    liveSocket?.emit('snaplive:send', { liveId, content }, (payload: SnapLiveAck) => {
      resolve(payload || { success: false });
    });
  });
}

export function sendSnapLiveReaction(liveId: string, reaction: string): Promise<SnapLiveAck> {
  return new Promise<SnapLiveAck>((resolve) => {
    liveSocket?.emit('snaplive:reaction', { liveId, reaction }, (payload: SnapLiveAck) => {
      resolve(payload || { success: false });
    });
  });
}

export function deleteSnapLiveMessage(liveId: string, messageId: string): Promise<SnapLiveAck> {
  return new Promise<SnapLiveAck>((resolve) => {
    liveSocket?.emit('snaplive:deleteMessage', { liveId, messageId }, (payload: SnapLiveAck) => {
      resolve(payload || { success: false });
    });
  });
}

export function muteSnapLiveUser(liveId: string, username: string): Promise<SnapLiveAck> {
  return new Promise<SnapLiveAck>((resolve) => {
    liveSocket?.emit('snaplive:muteUser', { liveId, username }, (payload: SnapLiveAck) => {
      resolve(payload || { success: false });
    });
  });
}
