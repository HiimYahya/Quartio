import { io } from 'socket.io-client'

const SOCKET_URL = 'https://quartio-production.up.railway.app'

let socket = null

export const getSocket = () => socket

export const connectSocket = (token) => {
  if (socket?.connected) return socket

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    timeout: 10000,
  })

  socket.on('connect_error', (err) => {
    // Socket.io pas encore implémenté côté backend — fail silencieux
    console.warn('[Socket] Connexion impossible:', err.message)
  })

  return socket
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

// ─── Événements standardisés ────────────────────────────────────────────────
// Backend devra émettre :
//   'user:online'   { userId }
//   'user:offline'  { userId }
//   'message:new'   { conversationId, message: { id, contenu, auteur_id, created_at } }
//   'typing:start'  { conversationId, userId }
//   'typing:stop'   { conversationId, userId }
//
// Backend devra écouter :
//   'join:conversation'  { conversationId }
//   'leave:conversation' { conversationId }
//   'typing:start'       { conversationId }
//   'typing:stop'        { conversationId }
