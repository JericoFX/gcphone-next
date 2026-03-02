import { io, type Socket } from 'socket.io-client';

export interface WaveSocketMessage {
  id: number;
  roomId: string;
  senderPhone: string;
  senderName: string;
  content: string;
  createdAt: number;
}

type AckPayload = { success?: boolean; error?: string; message?: WaveSocketMessage; messages?: WaveSocketMessage[] };

let socket: Socket | null = null;

export function disconnectWaveSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function connectWaveSocket(host: string, token: string, handlers: {
  onMessage?: (message: WaveSocketMessage) => void;
  onTyping?: (payload: { roomId: string; phone: string; typing: boolean }) => void;
  onDisconnect?: () => void;
}) {
  disconnectWaveSocket();
  socket = io(host, {
    auth: { token },
    transports: ['websocket'],
  });

  if (handlers.onMessage) {
    socket.on('wavechat:message', handlers.onMessage);
  }

  if (handlers.onTyping) {
    socket.on('wavechat:typing', handlers.onTyping);
  }

  if (handlers.onDisconnect) {
    socket.on('disconnect', handlers.onDisconnect);
  }

  return socket;
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

export function getWaveRecent(roomId: string, limit = 100) {
  return new Promise<AckPayload>((resolve) => {
    socket?.emit('wavechat:getRecent', { roomId, limit }, (payload: AckPayload) => {
      resolve(payload || { success: false, messages: [] });
    });
  });
}

export function sendWaveMessage(roomId: string, content: string) {
  return new Promise<AckPayload>((resolve) => {
    socket?.emit('wavechat:send', { roomId, content }, (payload: AckPayload) => {
      resolve(payload || { success: false });
    });
  });
}
