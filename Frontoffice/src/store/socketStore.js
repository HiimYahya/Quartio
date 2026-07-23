import { create } from 'zustand'
import { connectSocket, disconnectSocket, getSocket } from '../services/socket'
import api from '../services/api'

const useSocketStore = create((set, get) => ({
  connected:   false,
  onlineUsers: new Set(),
  alerts:      [],
  unreadNotifs: 0,

  connect: (token) => {
    const socket = connectSocket(token)

    socket.on('connect',    () => set({ connected: true  }))
    socket.on('disconnect', () => set({ connected: false }))

    socket.on('notification:new', () => get().refreshUnread())
    get().refreshUnread()

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

  refreshUnread: async () => {
    try {
      const { data } = await api.get('/notifications?est_lue=false&limit=1')
      set({ unreadNotifs: data.pagination?.total ?? 0 })
    } catch {  }
  },
  setUnread: (n) => set({ unreadNotifs: Math.max(0, n) }),

  disconnect: () => {
    disconnectSocket()
    set({ connected: false, onlineUsers: new Set() })
  },

  isOnline: (userId) => get().onlineUsers.has(userId),

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
