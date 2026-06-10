import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../services/api'

export default function ResetPasswordPage() {
  const { token }                   = useParams()
  const navigate                    = useNavigate()
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [success, setSuccess]       = useState(false)

  const strength = (() => {
    if (password.length === 0) return null
    let score = 0
    if (password.length >= 8)  score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return score
  })()

  const strengthLabel = ['Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'][strength ?? 0]
  const strengthColor = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'][strength ?? 0]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas')
    if (password.length < 8)  return setError('Le mot de passe doit faire au moins 8 caractères')

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
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-semibold text-[#1a4a3a] mb-2">Mot de passe mis à jour !</h2>
              <p className="text-gray-500 text-sm">Redirection vers la connexion…</p>
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
                    minLength={8}
                    placeholder="••••••••"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399] transition"
                  />
                  {password.length > 0 && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4].map((n) => (
                          <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${strength >= n ? strengthColor : 'bg-gray-200'}`} />
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">{strengthLabel}</p>
                    </div>
                  )}
                  <ul className="mt-2 text-xs text-gray-400 space-y-0.5">
                    <li className={password.length >= 8       ? 'text-green-600' : ''}>• 8 caractères minimum</li>
                    <li className={/[A-Z]/.test(password)     ? 'text-green-600' : ''}>• 1 majuscule</li>
                    <li className={/[0-9]/.test(password)     ? 'text-green-600' : ''}>• 1 chiffre</li>
                    <li className={/[^A-Za-z0-9]/.test(password) ? 'text-green-600' : ''}>• 1 caractère spécial</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError(null) }}
                    required
                    placeholder="••••••••"
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
                  {loading ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-400 mt-5">
                <Link to="/login" className="hover:underline">← Retour à la connexion</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
