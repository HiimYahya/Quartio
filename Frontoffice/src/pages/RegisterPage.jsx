import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { User, Mail, Lock } from 'lucide-react'
import useAuthStore from '../store/authStore'
import LangSwitcher from '../components/ui/LangSwitcher'
import PasswordStrengthMeter from '../components/ui/PasswordStrengthMeter'
import { isPasswordValid, PASSWORD_RULES_MESSAGE } from '../utils/passwordPolicy'

export default function RegisterPage() {
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', mot_de_passe: '' })
  const [cgu, setCgu] = useState(false)
  const { register, loading, error, clearError, setError } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const handleChange = (e) => {
    clearError()
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!cgu) {
      return setError('Vous devez accepter les conditions générales d\'utilisation.')
    }
    if (!isPasswordValid(form.mot_de_passe)) {
      return setError(PASSWORD_RULES_MESSAGE)
    }
    const result = await register(form)
    if (!result) return
    if (result.email_verification_required === false) {
      navigate('/login?verified=1')
    } else {
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}`)
    }
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
          <p className="text-white/60 mt-1">{t('auth.joinSlogan')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">{t('auth.register')}</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.firstName')}</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" name="prenom" value={form.prenom} onChange={handleChange} required placeholder="Jean"
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399] transition" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.lastName')}</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" name="nom" value={form.nom} onChange={handleChange} required placeholder="Dupont"
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399] transition" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="votre@email.com"
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399] transition" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="password" name="mot_de_passe" value={form.mot_de_passe} onChange={handleChange} required
                  placeholder={t('auth.passwordMin')}
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399] transition" />
              </div>
              <PasswordStrengthMeter password={form.mot_de_passe} />
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={cgu} onChange={(e) => { clearError(); setCgu(e.target.checked) }}
                className="mt-0.5 w-4 h-4 accent-[#1a4a3a]" />
              <span>
                J'accepte les{' '}
                <Link to="/mentions-legales" className="text-[#2d7a5f] font-medium hover:underline">conditions générales d'utilisation</Link>.
              </span>
            </label>
            <button type="submit" disabled={loading}
              className="w-full bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 mt-2">
              {loading ? t('auth.registering') : t('auth.register')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-[#2d7a5f] font-medium hover:underline">{t('auth.login')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
