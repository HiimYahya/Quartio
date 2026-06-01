import { create } from 'zustand'
import { connectSocket, disconnectSocket, getSocket } from '../services/socket'

const useSocketStore = create((set, get) => ({
  connected:  false,
  onlineUsers: new Set(), // Set de userId en ligne

  connect: (token) => {
    const socket = connectSocket(token)

    socket.on('connect', () => {
      set({ connected: true })
    })

    socket.on('disconnect', () => {
      set({ connected: false })
    })

    socket.on('user:online', ({ userId }) => {
      set((s) => ({ onlineUsers: new Set([...s.onlineUsers, userId]) }))
    })

    socket.on('user:offline', ({ userId }) => {
      set((s) => {
        const next = new Set(s.onlineUsers)
        next.delete(userId)
        return { onlineUsers: next }
      })
    })

    // Liste initiale des utilisateurs en ligne à la connexion
    socket.on('presence:snapshot', (userIds) => {
      set({ onlineUsers: new Set(userIds) })
    })
  },

  disconnect: () => {
    disconnectSocket()
    set({ connected: false, onlineUsers: new Set() })
  },

  isOnline: (userId) => get().onlineUsers.has(userId),

  // Rejoindre la room d'une conversation pour recevoir les messages temps réel
  joinConversation: (conversationId) => {
    getSocket()?.emit('join:conversation', { conversationId })
  },

  leaveConversation: (conversationId) => {
    getSocket()?.emit('leave:conversation', { conversationId })
  },

  emitTypingStart: (conversationId) => {
    getSocket()?.emit('typing:start', { conversationId })
  },

  emitTypingStop: (conversationId) => {
    getSocket()?.emit('typing:stop', { conversationId })
  },
}))

export default useSocketStore
