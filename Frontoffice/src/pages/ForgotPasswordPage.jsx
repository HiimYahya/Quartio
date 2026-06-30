import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck, ArrowLeft, Mail } from 'lucide-react'
import api from '../services/api'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Une erreur est survenue')
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
          <p className="text-white/60 mt-1">Réinitialisation du mot de passe</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {sent ? (
            <div className="text-center py-2">
              <MailCheck className="w-12 h-12 text-[#34d399] mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-[#1a4a3a] mb-3">Email envoyé</h2>
              <p className="text-gray-500 text-sm mb-6">
                Si cet email est associé à un compte Quartio, vous recevrez un lien de réinitialisation sous quelques minutes. Vérifiez également vos spams.
              </p>
              <Link to="/login" className="text-[#2d7a5f] text-sm font-medium hover:underline inline-flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Mot de passe oublié ?</h2>
              <p className="text-sm text-gray-500 mb-6">
                Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresse email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(null) }}
                      required
                      placeholder="votre@email.com"
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399] transition"
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60">
                  {loading ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-400 mt-5">
                <Link to="/login" className="hover:underline inline-flex items-center gap-1.5"><ArrowLeft className="w-3.5 h-3.5" /> Retour à la connexion</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
