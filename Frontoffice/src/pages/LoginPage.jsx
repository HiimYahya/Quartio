import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../store/authStore'
import LangSwitcher from '../components/ui/LangSwitcher'

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', mot_de_passe: '' })
  const { login, loading, error, clearError } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const handleChange = (e) => {
    clearError()
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ok = await login(form.email, form.mot_de_passe)
    if (ok) navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#1a4a3a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <LangSwitcher compact />
        </div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#34d399] rounded-2xl flex items-center justify-center text-[#1a4a3a] font-bold text-3xl mx-auto mb-4">Q</div>
          <h1 className="text-3xl font-bold text-white">Quartio</h1>
          <p className="text-white/60 mt-1">{t('auth.slogan')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">{t('auth.login')}</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} required
                placeholder="votre@email.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399] focus:border-transparent transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
              <input type="password" name="mot_de_passe" value={form.mot_de_passe} onChange={handleChange} required
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399] focus:border-transparent transition" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 mt-2">
              {loading ? t('auth.connecting') : t('auth.login')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-[#2d7a5f] font-medium hover:underline">{t('auth.register')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
