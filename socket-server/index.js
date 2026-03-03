import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

const port = Number(process.env.PORT || 3001);
const jwtSecret = process.env.JWT_SECRET || '';

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
    
    if (!phone) {
      next(new Error('INVALID_TOKEN'));
      return;
    }

    socket.data.phone = phone;
    socket.data.name = name || phone;
    socket.data.groups = groups;
    next();
  } catch {
    next(new Error('INVALID_TOKEN'));
  }
});

function canAccessRoom(socket, roomId) {
  return socket.data.groups.includes(roomId);
}

io.on('connection', (socket) => {
  const phone = socket.data.phone;
  const name = socket.data.name;

  socket.join(`user:${phone}`);

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

    socket.to(`room:${roomId}`).emit('wavechat:typing', {
      roomId,
      phone,
      typing,
    });
  });

  socket.on('wavechat:send', (payload = {}, ack) => {
    const roomId = String(payload.roomId || '').trim().slice(0, 64);
    let content = String(payload.content || '').replace(/[\x00-\x1F\x7F]/g, '').trim();
    
    if (!roomId) {
      if (typeof ack === 'function') ack({ success: false, error: 'INVALID_ROOM' });
      return;
    }

    if (!canAccessRoom(socket, roomId)) {
      if (typeof ack === 'function') ack({ success: false, error: 'FORBIDDEN' });
      return;
    }

    if (!content) {
      if (typeof ack === 'function') ack({ success: false, error: 'EMPTY_MESSAGE' });
      return;
    }

    content = content.slice(0, 800);
    const room = `room:${roomId}`;
    const createdAt = Date.now();

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      roomId,
      senderPhone: phone,
      senderName: name,
      content,
      createdAt,
    };

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
});

console.log(`gcphone socket server listening on ${port}`);
