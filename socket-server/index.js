import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

const port = Number(process.env.PORT || 3001);
const jwtSecret = process.env.JWT_SECRET || '';
const sqlitePath = path.resolve(process.env.SQLITE_PATH || './chat.db');

const SQL = await initSqlJs({});
const db = (() => {
  if (fs.existsSync(sqlitePath)) {
    const fileBuffer = fs.readFileSync(sqlitePath);
    return new SQL.Database(new Uint8Array(fileBuffer));
  }
  return new SQL.Database();
})();

db.run(`
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_room_time ON messages(room, created_at DESC);
`);

let flushTimer = null;
function flushDbSoon() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const data = db.export();
    fs.writeFileSync(sqlitePath, Buffer.from(data));
  }, 300);
}

function insertMessage(room, senderPhone, senderName, content, createdAt) {
  db.run(
    'INSERT INTO messages (room, sender_phone, sender_name, content, created_at) VALUES (?, ?, ?, ?, ?)',
    [room, senderPhone, senderName, content, createdAt]
  );
  const row = db.exec('SELECT last_insert_rowid() as id');
  flushDbSoon();
  return Number(row?.[0]?.values?.[0]?.[0] || 0);
}

function getRecentRoomMessages(room, limit) {
  const stmt = db.prepare(
    'SELECT id, room, sender_phone, sender_name, content, created_at FROM messages WHERE room = ? ORDER BY created_at DESC LIMIT ?'
  );
  stmt.bind([room, limit]);
  const out = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    out.push({
      id: Number(row.id),
      room: String(row.room),
      sender_phone: String(row.sender_phone),
      sender_name: String(row.sender_name),
      content: String(row.content),
      created_at: Number(row.created_at),
    });
  }
  stmt.free();
  return out;
}

const io = new Server(port, {
  cors: {
    origin: '*',
  },
  transports: ['websocket'],
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
    if (!phone) {
      next(new Error('INVALID_TOKEN'));
      return;
    }

    socket.data.phone = phone;
    socket.data.name = name || phone;
    next();
  } catch {
    next(new Error('INVALID_TOKEN'));
  }
});

io.on('connection', (socket) => {
  const phone = socket.data.phone;
  const name = socket.data.name;

  socket.join(`user:${phone}`);

  socket.on('wavechat:joinRoom', (payload = {}) => {
    const roomId = String(payload.roomId || '').trim().slice(0, 64);
    if (!roomId) return;
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

    if (!content) {
      if (typeof ack === 'function') ack({ success: false, error: 'EMPTY_MESSAGE' });
      return;
    }

    content = content.slice(0, 800);
    const room = `room:${roomId}`;
    const createdAt = Date.now();
    const id = insertMessage(room, phone, name, content, createdAt);

    const message = {
      id,
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
    const limitInput = Number(payload.limit || 50);
    const limit = Number.isFinite(limitInput) ? Math.max(1, Math.min(200, Math.floor(limitInput))) : 50;
    if (!roomId) {
      if (typeof ack === 'function') ack({ success: false, error: 'INVALID_ROOM', messages: [] });
      return;
    }

    const rows = getRecentRoomMessages(`room:${roomId}`, limit);
    const messages = rows
      .reverse()
      .map((row) => ({
        id: row.id,
        roomId,
        senderPhone: row.sender_phone,
        senderName: row.sender_name,
        content: row.content,
        createdAt: row.created_at,
      }));

    if (typeof ack === 'function') ack({ success: true, messages });
  });
});

process.on('SIGINT', () => {
  const data = db.export();
  fs.writeFileSync(sqlitePath, Buffer.from(data));
  process.exit(0);
});

console.log(`gcphone socket server listening on ${port}`);
