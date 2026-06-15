import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, Lock, ArrowRight, CheckCircle2 } from 'lucide-react'
import useAuthStore from '../store/authStore'
import LangSwitcher from '../components/ui/LangSwitcher'

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', mot_de_passe: '' })
  const [unverifiedEmail, setUnverifiedEmail] = useState(null)
  const { login, loading, error, clearError } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const verified = searchParams.get('verified')
  const reset    = searchParams.get('reset')

  const handleChange = (e) => {
    clearError()
    setUnverifiedEmail(null)
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await login(form.email, form.mot_de_passe)
    if (result === true) {
      navigate('/dashboard')
    } else if (result?.mfaRequired) {
      navigate('/mfa')
    } else if (result?.emailNotVerified) {
      setUnverifiedEmail(result.email || form.email)
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
          <p className="text-white/60 mt-1">{t('auth.slogan')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">{t('auth.login')}</h2>

          {verified && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-4 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Email vérifié - vous pouvez maintenant vous connecter.
            </div>
          )}

          {reset && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-4 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Mot de passe mis à jour - connectez-vous avec votre nouveau mot de passe.
            </div>
          )}

          {error && !unverifiedEmail && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
          )}

          {unverifiedEmail && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 mb-4 text-sm">
              <p className="font-medium mb-1">Email non vérifié</p>
              <p>Vérifiez votre boîte mail et entrez le code reçu.{' '}
                <Link
                  to={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
                  className="underline font-medium inline-flex items-center gap-1">
                  Vérifier maintenant <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="email" name="email" value={form.email} onChange={handleChange} required
                  placeholder="votre@email.com"
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399] focus:border-transparent transition" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">{t('auth.password')}</label>
                <Link to="/forgot-password" className="text-xs text-[#2d7a5f] hover:underline">
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="password" name="mot_de_passe" value={form.mot_de_passe} onChange={handleChange} required
                  placeholder="--------"
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399] focus:border-transparent transition" />
              </div>
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
