const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');

const onlineUsers = new Map();

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token manquant'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.id;
      socket.userEmail = payload.email;
      next();
    } catch {
      next(new Error('Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    const uid = socket.userId;

    if (!onlineUsers.has(uid)) onlineUsers.set(uid, new Set());
    onlineUsers.get(uid).add(socket.id);

    socket.emit('presence:snapshot', [...onlineUsers.keys()]);

    socket.broadcast.emit('user:online', { userId: uid });

    socket.on('join:conversation', ({ conversationId }) => {
      if (conversationId) socket.join(`conv:${conversationId}`);
    });

    socket.on('leave:conversation', ({ conversationId }) => {
      if (conversationId) socket.leave(`conv:${conversationId}`);
    });

    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:start', { conversationId, userId: uid });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:stop', { conversationId, userId: uid });
    });

    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(uid);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(uid);
          socket.broadcast.emit('user:offline', { userId: uid });
        }
      }
    });
  });

  return io;
}

function emitNewMessage(conversationId, message) {
  if (!io) return;
  io.to(`conv:${conversationId}`).emit('message:new', {
    conversationId: conversationId.toString(),
    message,
  });
}

function emitNotification(userId, notification) {
  if (!io) return;
  const sockets = onlineUsers.get(userId);
  if (sockets) {
    sockets.forEach((sid) => {
      io.to(sid).emit('notification:new', notification);
    });
  }
}

// Utilisateurs ayant actuellement la conversation ouverte (présents dans la room socket)
function getUsersInConversation(conversationId) {
  const users = new Set();
  if (!io) return users;
  const room = io.sockets.adapter.rooms.get(`conv:${conversationId}`);
  if (!room) return users;
  for (const sid of room) {
    const s = io.sockets.sockets.get(sid);
    if (s?.userId) users.add(s.userId);
  }
  return users;
}

function getIo() { return io; }

function emitAlert(type, payload, targetUserIds = null) {
  if (!io) return;
  const event = `alert:${type}`;
  if (targetUserIds) {
    targetUserIds.forEach((uid) => {
      const sockets = onlineUsers.get(uid);
      if (sockets) sockets.forEach((sid) => io.to(sid).emit(event, payload));
    });
  } else {
    io.emit(event, payload);
  }
}

function emitVoteUpdate(voteId) {
  if (!io) return;
  io.emit('vote:update', { id_vote: voteId });
}

module.exports = { initSocket, emitNewMessage, emitNotification, emitAlert, emitVoteUpdate, getUsersInConversation, getIo };
