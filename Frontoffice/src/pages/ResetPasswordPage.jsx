import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import api from '../services/api'
import PasswordStrengthMeter from '../components/ui/PasswordStrengthMeter'
import { isPasswordValid, PASSWORD_RULES_MESSAGE } from '../utils/passwordPolicy'

export default function ResetPasswordPage() {
  const { token }                   = useParams()
  const navigate                    = useNavigate()
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [success, setSuccess]       = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas')
    if (!isPasswordValid(password)) return setError(PASSWORD_RULES_MESSAGE)

    setLoading(true)
    setError(null)
    try {
      await api.post('/auth/reset-password', { token, mot_de_passe: password })
      setSuccess(true)
      setTimeout(() => navigate('/login?reset=1'), 2500)
    } catch (err) {
      setError(err.response?.data?.error || 'Lien invalide ou expiré')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1a4a3a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#34d399] rounded-2xl flex items-center justify-center text-[#1a4a3a] font-bold text-3xl mx-auto mb-4">Q</div>
          <h1 className="text-3xl font-bold text-white">Quartio</h1>
          <p className="text-white/60 mt-1">Nouveau mot de passe</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-[#34d399] mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-[#1a4a3a] mb-2">Mot de passe mis à jour !</h2>
              <p className="text-gray-500 text-sm">Redirection vers la connexion...</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Choisir un nouveau mot de passe</h2>
              <p className="text-sm text-gray-500 mb-6">
                Ce lien expire dans 1 heure. Choisissez un mot de passe fort.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null) }}
                    required
                    placeholder="--------"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399] transition"
                  />
                  <PasswordStrengthMeter password={password} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError(null) }}
                    required
                    placeholder="--------"
                    className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399] transition ${
                      confirm && confirm !== password ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {confirm && confirm !== password && (
                    <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
                  )}
                </div>

                <button type="submit" disabled={loading}
                  className="w-full bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60">
                  {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-400 mt-5">
                <Link to="/login" className="hover:underline">{'<- Retour à la connexion'}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
