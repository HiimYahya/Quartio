import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'https://quartio-production.up.railway.app/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Rafraîchissement transparent de l'access token sur 401 ---
let isRefreshing = false;
let waiters = [];

const notifyWaiters = (newToken) => {
  waiters.forEach((cb) => cb(newToken));
  waiters = [];
};

const forceLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  if (window.location.pathname !== '/login') window.location.href = '/login';
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const status = err.response?.status;

    // On ne tente le refresh que sur un 401, une seule fois, et jamais pour /auth/refresh lui-même.
    if (status !== 401 || !original || original._retry || original.url?.includes('/auth/refresh')) {
      return Promise.reject(err);
    }

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      forceLogout();
      return Promise.reject(err);
    }

    original._retry = true;

    // Un refresh est déjà en cours : on met la requête en file d'attente.
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waiters.push((newToken) => {
          if (!newToken) return reject(err);
          original.headers.Authorization = `Bearer ${newToken}`;
          resolve(api(original));
        });
      });
    }

    isRefreshing = true;
    try {
      // axios "nu" pour ne pas repasser par cet intercepteur.
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
      const newToken = data.access_token;
      localStorage.setItem('token', newToken);
      isRefreshing = false;
      notifyWaiters(newToken);
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshErr) {
      isRefreshing = false;
      notifyWaiters(null);
      forceLogout();
      return Promise.reject(refreshErr);
    }
  }
);

export default api;
