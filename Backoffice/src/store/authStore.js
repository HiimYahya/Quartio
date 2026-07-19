import { create } from 'zustand'
import api from '../services/api'

const useAuthStore = create((set) => ({
  admin: null,
  token: localStorage.getItem('admin_token') || null,
  mfaToken: null,
  loading: false,
  error: null,

  login: async (email, mot_de_passe) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/auth/login', { email, mot_de_passe })
      if (data.mfa_required) {
        set({ loading: false, mfaToken: data.mfa_token, error: null })
        return { mfaRequired: true }
      }
      if (!['admin', 'moderateur'].includes(data.utilisateur?.role)) {
        set({ error: 'Accès réservé aux administrateurs et modérateurs.', loading: false })
        return false
      }
      localStorage.setItem('admin_token', data.access_token)
      if (data.refresh_token) localStorage.setItem('admin_refresh_token', data.refresh_token)
      set({ token: data.access_token, admin: data.utilisateur, loading: false })
      return true
    } catch (err) {
      set({ error: err.response?.data?.error || 'Identifiants incorrects', loading: false })
      return false
    }
  },

  verifyMfa: async (code) => {
    set({ loading: true, error: null })
    const { mfaToken } = useAuthStore.getState()
    try {
      const { data } = await api.post('/auth/mfa/verify', { mfa_token: mfaToken, code })
      if (!['admin', 'moderateur'].includes(data.utilisateur?.role)) {
        set({ error: 'Accès réservé aux administrateurs et modérateurs.', loading: false, mfaToken: null })
        return false
      }
      localStorage.setItem('admin_token', data.access_token)
      if (data.refresh_token) localStorage.setItem('admin_refresh_token', data.refresh_token)
      set({ token: data.access_token, admin: data.utilisateur, mfaToken: null, loading: false })
      return true
    } catch (err) {
      set({ error: err.response?.data?.error || 'Code invalide', loading: false })
      return false
    }
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/auth/me')
      if (!['admin', 'moderateur'].includes(data.role)) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_refresh_token')
        set({ admin: null, token: null })
        return
      }
      set({ admin: { ...data, id: data.id ?? data.id_utilisateur } })
    } catch {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_refresh_token')
      set({ admin: null, token: null })
    }
  },

  logout: () => {
    const refresh_token = localStorage.getItem('admin_refresh_token')
    api.post('/auth/logout', { refresh_token }).catch(() => {})
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_refresh_token')
    set({ admin: null, token: null })
  },

  clearError: () => set({ error: null }),
}))

export default useAuthStore
