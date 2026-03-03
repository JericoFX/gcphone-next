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
