import { create } from 'zustand'
import { connectSocket, disconnectSocket, getSocket } from '../services/socket'

const useSocketStore = create((set, get) => ({
  connected:   false,
  onlineUsers: new Set(),
  alerts:      [], // alertes temps réel non lues

  connect: (token) => {
    const socket = connectSocket(token)

    socket.on('connect',    () => set({ connected: true  }))
    socket.on('disconnect', () => set({ connected: false }))

    socket.on('user:online', ({ userId }) => {
      set((s) => ({ onlineUsers: new Set([...s.onlineUsers, userId]) }))
    })
    socket.on('user:offline', ({ userId }) => {
      set((s) => {
        const next = new Set(s.onlineUsers); next.delete(userId)
        return { onlineUsers: next }
      })
    })
    socket.on('presence:snapshot', (userIds) => {
      set({ onlineUsers: new Set(userIds) })
    })

    // Alertes temps réel
    const handleAlert = (type) => (payload) => {
      set((s) => ({ alerts: [{ type, ...payload, at: Date.now() }, ...s.alerts].slice(0, 10) }))
    }
    socket.on('alert:incident', handleAlert('incident'))
    socket.on('alert:contrat',  handleAlert('contrat'))
    socket.on('alert:vote',     handleAlert('vote'))
    socket.on('alert:evenement',handleAlert('evenement'))
  },

  dismissAlert: (at) => set((s) => ({ alerts: s.alerts.filter((a) => a.at !== at) })),
  clearAlerts:  () => set({ alerts: [] }),

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
