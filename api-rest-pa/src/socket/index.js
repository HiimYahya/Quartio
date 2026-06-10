const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');

// Map userId (PG int) → Set de socketIds
const onlineUsers = new Map();

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });

  // ── Middleware d'authentification JWT ──────────────────────────────────────
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

  // ── Connexion ──────────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const uid = socket.userId;

    // Enregistre la présence
    if (!onlineUsers.has(uid)) onlineUsers.set(uid, new Set());
    onlineUsers.get(uid).add(socket.id);

    // Envoie le snapshot de présence au nouvel arrivant
    socket.emit('presence:snapshot', [...onlineUsers.keys()]);

    // Annonce aux autres que cet utilisateur est en ligne
    socket.broadcast.emit('user:online', { userId: uid });

    // ── Rooms de conversation ────────────────────────────────────────────────
    socket.on('join:conversation', ({ conversationId }) => {
      if (conversationId) socket.join(`conv:${conversationId}`);
    });

    socket.on('leave:conversation', ({ conversationId }) => {
      if (conversationId) socket.leave(`conv:${conversationId}`);
    });

    // ── Typing indicators ────────────────────────────────────────────────────
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:start', { conversationId, userId: uid });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:stop', { conversationId, userId: uid });
    });

    // ── Déconnexion ──────────────────────────────────────────────────────────
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

// Émet un nouveau message dans la room de la conversation
function emitNewMessage(conversationId, message) {
  if (!io) return;
  io.to(`conv:${conversationId}`).emit('message:new', {
    conversationId: conversationId.toString(),
    message,
  });
}

// Émet une notification générale (badge sidebar, etc.)
function emitNotification(userId, notification) {
  if (!io) return;
  // Émet à tous les sockets de cet utilisateur
  const sockets = onlineUsers.get(userId);
  if (sockets) {
    sockets.forEach((sid) => {
      io.to(sid).emit('notification:new', notification);
    });
  }
}

function getIo() { return io; }

// Émet une alerte à tous les utilisateurs en ligne (ou à une liste d'userIds ciblés)
// type : 'incident' | 'contrat' | 'vote' | 'evenement'
function emitAlert(type, payload, targetUserIds = null) {
  if (!io) return;
  const event = `alert:${type}`;
  if (targetUserIds) {
    // Alerte ciblée (ex: contrat en attente de signature d'un utilisateur précis)
    targetUserIds.forEach((uid) => {
      const sockets = onlineUsers.get(uid);
      if (sockets) sockets.forEach((sid) => io.to(sid).emit(event, payload));
    });
  } else {
    // Alerte broadcast à tous les connectés
    io.emit(event, payload);
  }
}

module.exports = { initSocket, emitNewMessage, emitNotification, emitAlert, getIo };
