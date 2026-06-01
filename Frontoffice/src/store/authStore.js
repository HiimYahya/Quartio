import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  loading: false,
  error: null,

  login: async (email, mot_de_passe) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email, mot_de_passe });
      localStorage.setItem('token', data.access_token);
      set({ token: data.access_token, user: data.utilisateur, loading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Erreur de connexion', loading: false });
      return false;
    }
  },

  register: async (payload) => {
    set({ loading: true, error: null });
    try {
      await api.post('/auth/register', payload);
      set({ loading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || "Erreur d'inscription", loading: false });
      return false;
    }
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/auth/me');
      // normalise id_utilisateur → id
      const user = { ...data, id: data.id ?? data.id_utilisateur };
      set({ user });
    } catch {
      set({ user: null, token: null });
      localStorage.removeItem('token');
    }
  },

  logout: () => {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
