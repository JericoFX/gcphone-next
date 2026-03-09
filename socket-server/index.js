import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

const port = Number(process.env.PORT || 3001);
const jwtSecret = process.env.JWT_SECRET || '';
const snapLiveRooms = new Map();
const wavePersistQueue = [];
const wavePersistPending = new Map();
let wavePersistTimer = null;
let wavePersistRequestId = 1;
const WAVE_BATCH_SIZE = 25;
const WAVE_BATCH_DELAY_MS = 900;

const io = new Server(port, {
  cors: {
    origin: '*',
  },
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.use((socket, next) => {
  if (!jwtSecret) {
    next(new Error('JWT_NOT_CONFIGURED'));
    return;
  }

  const rawToken = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
  if (!rawToken) {
    next(new Error('MISSING_TOKEN'));
    return;
  }

  try {
    const decoded = jwt.verify(rawToken, jwtSecret);
    const phone = typeof decoded.phone === 'string' ? decoded.phone.trim().slice(0, 20) : '';
    const name = typeof decoded.name === 'string' ? decoded.name.trim().slice(0, 64) : '';
    const groups = Array.isArray(decoded.groups) ? decoded.groups.map(g => String(g).slice(0, 10)) : [];
    const identifier = typeof decoded.identifier === 'string' ? decoded.identifier.trim().slice(0, 80) : '';
    const snapLiveId = typeof decoded.snapLiveId === 'string' ? decoded.snapLiveId.replace(/[^0-9]/g, '').slice(0, 16) : '';
    const snapRole = typeof decoded.snapRole === 'string' ? decoded.snapRole.trim().toLowerCase().slice(0, 16) : '';
    const snapUsername = typeof decoded.snapUsername === 'string' ? decoded.snapUsername.trim().slice(0, 32) : '';
    const snapDisplay = typeof decoded.snapDisplay === 'string' ? decoded.snapDisplay.trim().slice(0, 64) : '';
    const snapAvatar = typeof decoded.snapAvatar === 'string' ? decoded.snapAvatar.trim().slice(0, 255) : '';
    
    if (!phone) {
      next(new Error('INVALID_TOKEN'));
      return;
    }

    socket.data.phone = phone;
    socket.data.name = name || phone;
    socket.data.groups = groups;
    socket.data.identifier = identifier;
    socket.data.snapLiveId = snapLiveId;
    socket.data.snapRole = snapRole === 'owner' ? 'owner' : 'viewer';
    socket.data.snapUsername = snapUsername;
    socket.data.snapDisplay = snapDisplay || snapUsername || phone;
    socket.data.snapAvatar = snapAvatar;
    next();
  } catch {
    next(new Error('INVALID_TOKEN'));
  }
});

function canAccessRoom(socket, roomId) {
  return socket.data.groups.includes(roomId);
}

function nowMs() {
  return Date.now();
}

function toPositiveInt(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return 0;
  return Math.floor(num);
}

function scheduleWavePersistFlush() {
  if (wavePersistTimer) return;
  wavePersistTimer = setTimeout(() => {
    wavePersistTimer = null;
    void flushWavePersistQueue();
  }, WAVE_BATCH_DELAY_MS);
}

function requestWavePersist(batch) {
  return new Promise((resolve) => {
    const requestId = wavePersistRequestId++;
    wavePersistPending.set(requestId, resolve);
    emit('gcphone:wavechat:persistBatch', requestId, batch);
    setTimeout(() => {
      const pending = wavePersistPending.get(requestId);
      if (!pending) return;
      wavePersistPending.delete(requestId);
      pending({ success: false, count: 0, error: 'TIMEOUT' });
    }, 5000);
  });
}

async function flushWavePersistQueue() {
  if (wavePersistQueue.length === 0) return;

  const batch = wavePersistQueue.splice(0, WAVE_BATCH_SIZE);
  const result = await requestWavePersist(batch);
  if (!result?.success) {
    console.warn('[wavechat] failed to persist batch', result?.error || 'UNKNOWN');
  }

  if (wavePersistQueue.length > 0) {
    scheduleWavePersistFlush();
  }
}

function queueWavePersist(entry) {
  wavePersistQueue.push(entry);
  if (wavePersistQueue.length >= WAVE_BATCH_SIZE) {
    void flushWavePersistQueue();
    return;
  }
  scheduleWavePersistFlush();
}

on('gcphone:wavechat:persistBatchResult', (requestId, success, count, error) => {
  const id = Number(requestId) || 0;
  const pending = wavePersistPending.get(id);
  if (!pending) return;
  wavePersistPending.delete(id);
  pending({ success: success === true, count: Number(count) || 0, error: typeof error === 'string' ? error : '' });
});

function normalizeSnapLiveId(value) {
  const liveId = String(value || '').trim();
  return /^\d+$/.test(liveId) ? liveId : '';
}

function normalizeSnapText(value, maxLen) {
  const text = String(value || '').replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (!text) return '';
  return text.slice(0, maxLen);
}

function getSnapRoomName(liveId) {
  return `snaplive:${liveId}`;
}

function ensureSnapLiveRoom(liveId) {
  let room = snapLiveRooms.get(liveId);
  if (!room) {
    room = {
      liveId,
      ownerIdentifier: '',
      messages: [],
      mutedIdentifiers: new Set(),
      viewers: new Set(),
    };
    snapLiveRooms.set(liveId, room);
  }
  return room;
}

function getSnapViewerCount(room) {
  return room?.viewers?.size || 0;
}

function emitSnapViewerCount(liveId) {
  const room = snapLiveRooms.get(liveId);
  io.to(getSnapRoomName(liveId)).emit('snaplive:viewersUpdated', {
    liveId,
    viewers: getSnapViewerCount(room),
  });
}

function cleanupSnapSocket(socket) {
  const joinedLiveId = socket.data.joinedSnapLiveId;
  if (!joinedLiveId) return;

  const room = snapLiveRooms.get(joinedLiveId);
  if (!room) {
    socket.data.joinedSnapLiveId = '';
    return;
  }

  room.viewers.delete(socket.data.identifier || socket.id);
  socket.leave(getSnapRoomName(joinedLiveId));
  socket.data.joinedSnapLiveId = '';

  if (room.ownerIdentifier && room.ownerIdentifier === socket.data.identifier) {
    snapLiveRooms.delete(joinedLiveId);
    return;
  }

  if (room.viewers.size === 0 && room.messages.length === 0) {
    snapLiveRooms.delete(joinedLiveId);
    return;
  }

  emitSnapViewerCount(joinedLiveId);
}

io.on('connection', (socket) => {
  const phone = socket.data.phone;
  const name = socket.data.name;
  const eventState = {
    typingByRoom: new Map(),
    recentMessages: [],
  };

  socket.join(`user:${phone}`);
  for (const roomId of socket.data.groups || []) {
    if (!roomId) continue;
    socket.join(`room:${roomId}`);
  }

  socket.on('snaplive:joinRoom', (payload = {}, ack) => {
    const liveId = normalizeSnapLiveId(payload.liveId);
    if (!liveId || socket.data.snapLiveId !== liveId || !socket.data.snapUsername) {
      if (typeof ack === 'function') ack({ success: false, error: 'FORBIDDEN', messages: [] });
      return;
    }

    cleanupSnapSocket(socket);

    const room = ensureSnapLiveRoom(liveId);
    if (socket.data.snapRole === 'owner') {
      room.ownerIdentifier = socket.data.identifier || room.ownerIdentifier;
    }

    room.viewers.add(socket.data.identifier || socket.id);
    socket.join(getSnapRoomName(liveId));
    socket.data.joinedSnapLiveId = liveId;

    emitSnapViewerCount(liveId);
    if (typeof ack === 'function') {
      ack({ success: true, viewers: getSnapViewerCount(room), messages: room.messages.slice(-20) });
    }
  });

  socket.on('snaplive:leaveRoom', (payload = {}) => {
    const liveId = normalizeSnapLiveId(payload.liveId);
    if (!liveId || socket.data.joinedSnapLiveId !== liveId) return;
    cleanupSnapSocket(socket);
  });

  socket.on('snaplive:send', (payload = {}, ack) => {
    const liveId = normalizeSnapLiveId(payload.liveId);
    const content = normalizeSnapText(payload.content, 400);
    if (!liveId || !content || socket.data.joinedSnapLiveId !== liveId) {
      if (typeof ack === 'function') ack({ success: false, error: 'INVALID_PAYLOAD' });
      return;
    }

    const room = snapLiveRooms.get(liveId);
    if (!room) {
      if (typeof ack === 'function') ack({ success: false, error: 'LIVE_UNAVAILABLE' });
      return;
    }

    if (room.mutedIdentifiers.has(socket.data.identifier)) {
      if (typeof ack === 'function') ack({ success: false, error: 'MUTED' });
      return;
    }

    const stamp = nowMs();
    const message = {
      id: `${stamp}-${Math.random().toString(36).slice(2, 8)}`,
      liveId,
      authorId: socket.data.identifier,
      username: socket.data.snapUsername,
      display: socket.data.snapDisplay,
      avatar: socket.data.snapAvatar || undefined,
      content,
      isMention: false,
      createdAt: stamp,
    };

    room.messages.push(message);
    while (room.messages.length > 20) {
      room.messages.shift();
    }

    io.to(getSnapRoomName(liveId)).emit('snaplive:message', message);
    if (typeof ack === 'function') ack({ success: true, message });
  });

  socket.on('snaplive:reaction', (payload = {}, ack) => {
    const liveId = normalizeSnapLiveId(payload.liveId);
    const reaction = normalizeSnapText(payload.reaction, 24);
    if (!liveId || !reaction || socket.data.joinedSnapLiveId !== liveId) {
      if (typeof ack === 'function') ack({ success: false, error: 'INVALID_PAYLOAD' });
      return;
    }

    const room = snapLiveRooms.get(liveId);
    if (!room) {
      if (typeof ack === 'function') ack({ success: false, error: 'LIVE_UNAVAILABLE' });
      return;
    }

    const entry = {
      id: `${nowMs()}-${Math.random().toString(36).slice(2, 8)}`,
      liveId,
      username: socket.data.snapUsername,
      avatar: socket.data.snapAvatar || undefined,
      reaction,
      createdAt: nowMs(),
    };

    io.to(getSnapRoomName(liveId)).emit('snaplive:reaction', entry);
    if (typeof ack === 'function') ack({ success: true });
  });

  socket.on('snaplive:deleteMessage', (payload = {}, ack) => {
    const liveId = normalizeSnapLiveId(payload.liveId);
    const messageId = normalizeSnapText(payload.messageId, 64);
    const room = snapLiveRooms.get(liveId);
    if (!liveId || !messageId || !room || socket.data.joinedSnapLiveId !== liveId) {
      if (typeof ack === 'function') ack({ success: false, error: 'INVALID_PAYLOAD' });
      return;
    }

    if (!room.ownerIdentifier || room.ownerIdentifier !== socket.data.identifier) {
      if (typeof ack === 'function') ack({ success: false, error: 'FORBIDDEN' });
      return;
    }

    room.messages = room.messages.filter((entry) => entry.id !== messageId);
    io.to(getSnapRoomName(liveId)).emit('snaplive:messageDeleted', { liveId, messageId });
    if (typeof ack === 'function') ack({ success: true });
  });

  socket.on('snaplive:muteUser', (payload = {}, ack) => {
    const liveId = normalizeSnapLiveId(payload.liveId);
    const username = normalizeSnapText(payload.username, 32);
    const room = snapLiveRooms.get(liveId);
    if (!liveId || !username || !room || socket.data.joinedSnapLiveId !== liveId) {
      if (typeof ack === 'function') ack({ success: false, error: 'INVALID_PAYLOAD' });
      return;
    }

    if (!room.ownerIdentifier || room.ownerIdentifier !== socket.data.identifier) {
      if (typeof ack === 'function') ack({ success: false, error: 'FORBIDDEN' });
      return;
    }

    for (const [id, connectedSocket] of io.of('/').sockets) {
      if (!connectedSocket || id === socket.id) continue;
      if (connectedSocket.data?.joinedSnapLiveId !== liveId) continue;
      if (String(connectedSocket.data?.snapUsername || '').toLowerCase() !== username.toLowerCase()) continue;
      room.mutedIdentifiers.add(connectedSocket.data.identifier);
      io.to(getSnapRoomName(liveId)).emit('snaplive:userMuted', { liveId, username });
      if (typeof ack === 'function') ack({ success: true });
      return;
    }

    if (typeof ack === 'function') ack({ success: false, error: 'USER_NOT_FOUND' });
  });

  socket.on('wavechat:joinRoom', (payload = {}) => {
    const roomId = String(payload.roomId || '').trim().slice(0, 64);
    if (!roomId) return;
    
    if (!canAccessRoom(socket, roomId)) {
      socket.emit('wavechat:error', { code: 'FORBIDDEN', message: 'Not a member of this group' });
      return;
    }
    
    socket.join(`room:${roomId}`);
  });

  socket.on('wavechat:leaveRoom', (payload = {}) => {
    const roomId = String(payload.roomId || '').trim().slice(0, 64);
    if (!roomId) return;
    socket.leave(`room:${roomId}`);
  });

  socket.on('wavechat:typing', (payload = {}) => {
    const roomId = String(payload.roomId || '').trim().slice(0, 64);
    const typing = payload.typing === true;
    if (!roomId) return;

    if (!canAccessRoom(socket, roomId)) return;

    const stamp = nowMs();
    const lastTypingAt = eventState.typingByRoom.get(roomId) || 0;
    if (typing && stamp - lastTypingAt < 350) return;
    eventState.typingByRoom.set(roomId, stamp);

    socket.to(`room:${roomId}`).emit('wavechat:typing', {
      roomId,
      phone,
      typing,
    });
  });

  socket.on('wavechat:send', (payload = {}, ack) => {
    const roomId = String(payload.roomId || '').trim().slice(0, 64);
    let content = String(payload.content || '').replace(/[\x00-\x1F\x7F]/g, '').trim();
    const mediaUrl = normalizeSnapText(payload.mediaUrl, 500);
    
    if (!roomId) {
      if (typeof ack === 'function') ack({ success: false, error: 'INVALID_ROOM' });
      return;
    }

    if (!canAccessRoom(socket, roomId)) {
      if (typeof ack === 'function') ack({ success: false, error: 'FORBIDDEN' });
      return;
    }

    if (!content && !mediaUrl) {
      if (typeof ack === 'function') ack({ success: false, error: 'EMPTY_MESSAGE' });
      return;
    }

    content = content.slice(0, 800);
    const stamp = nowMs();
    eventState.recentMessages = eventState.recentMessages.filter((entry) => stamp - entry < 5000);
    if (eventState.recentMessages.length >= 6) {
      if (typeof ack === 'function') ack({ success: false, error: 'RATE_LIMITED' });
      return;
    }
    eventState.recentMessages.push(stamp);

    const room = `room:${roomId}`;
    const createdAt = stamp;

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      roomId,
      senderPhone: phone,
      senderName: name,
      content,
      mediaUrl: mediaUrl || undefined,
      createdAt,
    };

    queueWavePersist({
      groupId: toPositiveInt(roomId),
      senderIdentifier: socket.data.identifier || '',
      senderPhone: phone,
      message: content,
      mediaUrl: mediaUrl || '',
    });

    io.to(room).emit('wavechat:message', message);
    if (typeof ack === 'function') ack({ success: true, message });
  });

  socket.on('wavechat:getRecent', (payload = {}, ack) => {
    const roomId = String(payload.roomId || '').trim().slice(0, 64);
    
    if (!roomId) {
      if (typeof ack === 'function') ack({ success: false, error: 'INVALID_ROOM', messages: [] });
      return;
    }

    if (!canAccessRoom(socket, roomId)) {
      if (typeof ack === 'function') ack({ success: false, error: 'FORBIDDEN', messages: [] });
      return;
    }

    if (typeof ack === 'function') ack({ success: true, messages: [] });
  });

  socket.on('disconnect', () => {
    cleanupSnapSocket(socket);
  });
});

console.log(`gcphone socket server listening on ${port}`);
