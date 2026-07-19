import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  mfaToken: null,
  loading: false,
  error: null,

  login: async (email, mot_de_passe) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email, mot_de_passe });
      if (data.mfa_required) {
        set({ loading: false, mfaToken: data.mfa_token, error: null });
        return { mfaRequired: true };
      }
      localStorage.setItem('token', data.access_token);
      set({ token: data.access_token, user: data.utilisateur, loading: false });
      return true;
    } catch (err) {
      const resp = err.response?.data;
      if (resp?.email_verification_required) {
        set({ loading: false, error: null });
        return { emailNotVerified: true, email: resp.email };
      }
      set({ error: resp?.error || 'Erreur de connexion', loading: false });
      return false;
    }
  },

  verifyMfa: async (code) => {
    set({ loading: true, error: null });
    const { mfaToken } = useAuthStore.getState();
    try {
      const { data } = await api.post('/auth/mfa/verify', { mfa_token: mfaToken, code });
      localStorage.setItem('token', data.access_token);
      set({ token: data.access_token, user: data.utilisateur, mfaToken: null, loading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Code invalide', loading: false });
      return false;
    }
  },

  register: async (payload) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/register', payload);
      set({ loading: false });
      return data;
    } catch (err) {
      set({ error: err.response?.data?.error || "Erreur d'inscription", loading: false });
      return null;
    }
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/auth/me');
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
  setError: (error) => set({ error }),
}));

export default useAuthStore;
