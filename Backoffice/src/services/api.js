import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'https://quartio-production.up.railway.app/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// --- Rafraîchissement transparent de l'access token sur 401 ---
let isRefreshing = false
let waiters = []

const notifyWaiters = (newToken) => {
  waiters.forEach((cb) => cb(newToken))
  waiters = []
}

const forceLogout = () => {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_refresh_token')
  if (window.location.pathname !== '/login') window.location.href = '/login'
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const status = err.response?.status

    if (status !== 401 || !original || original._retry || original.url?.includes('/auth/refresh')) {
      return Promise.reject(err)
    }

    const refreshToken = localStorage.getItem('admin_refresh_token')
    if (!refreshToken) {
      forceLogout()
      return Promise.reject(err)
    }

    original._retry = true

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waiters.push((newToken) => {
          if (!newToken) return reject(err)
          original.headers.Authorization = `Bearer ${newToken}`
          resolve(api(original))
        })
      })
    }

    isRefreshing = true
    try {
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
      const newToken = data.access_token
      localStorage.setItem('admin_token', newToken)
      isRefreshing = false
      notifyWaiters(newToken)
      original.headers.Authorization = `Bearer ${newToken}`
      return api(original)
    } catch (refreshErr) {
      isRefreshing = false
      notifyWaiters(null)
      forceLogout()
      return Promise.reject(refreshErr)
    }
  }
)

export default api
