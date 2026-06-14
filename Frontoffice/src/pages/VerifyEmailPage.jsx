import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import api from '../services/api'

const RESEND_COOLDOWN = 60
const CODE_EXPIRE_SECONDS = 15 * 60

export default function VerifyEmailPage() {
  const [searchParams]        = useSearchParams()
  const email                 = searchParams.get('email') || ''
  const [digits, setDigits]   = useState(['', '', '', '', '', ''])
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN)
  const [resending, setResending]           = useState(false)
  const [expireLeft, setExpireLeft]         = useState(CODE_EXPIRE_SECONDS)
  const inputsRef = useRef([])
  const navigate  = useNavigate()

  // Compte à rebours cooldown renvoi
  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setInterval(() => setResendCooldown((n) => n - 1), 1000)
    return () => clearInterval(id)
  }, [resendCooldown])

  // Compte à rebours expiration code
  useEffect(() => {
    if (expireLeft <= 0) return
    const id = setInterval(() => setExpireLeft((n) => n - 1), 1000)
    return () => clearInterval(id)
  }, [])

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const handleDigit = (index, value) => {
    if (!/^\d?$/.test(value)) return
    const next = [...digits]
    next[index] = value
    setDigits(next)
    setError(null)
    if (value && index < 5) inputsRef.current[index + 1]?.focus()
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && index > 0)  inputsRef.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < 5) inputsRef.current[index + 1]?.focus()
  }

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setDigits(text.split(''))
      inputsRef.current[5]?.focus()
      e.preventDefault()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const code = digits.join('')
    if (code.length < 6) return setError('Entrez le code à 6 chiffres complet')

    setLoading(true)
    setError(null)
    try {
      await api.post('/auth/verify-email', { email, code })
      setSuccess(true)
      setTimeout(() => navigate('/login?verified=1'), 2500)
    } catch (err) {
      setError(err.response?.data?.error || 'Code invalide ou expiré')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setResending(true)
    setError(null)
    try {
      await api.post('/auth/resend-verification', { email })
      setResendCooldown(RESEND_COOLDOWN)
      setExpireLeft(CODE_EXPIRE_SECONDS)
      setDigits(['', '', '', '', '', ''])
      inputsRef.current[0]?.focus()
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du renvoi')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1a4a3a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#34d399] rounded-2xl flex items-center justify-center text-[#1a4a3a] font-bold text-3xl mx-auto mb-4">Q</div>
          <h1 className="text-3xl font-bold text-white">Quartio</h1>
          <p className="text-white/60 mt-1">Vérification de votre email</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-[#34d399] mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-[#1a4a3a] mb-2">Email vérifié !</h2>
              <p className="text-gray-500 text-sm">Redirection vers la connexion...</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Vérifiez votre email</h2>
              <p className="text-sm text-gray-500 mb-6">
                Un code à 6 chiffres a été envoyé à <span className="font-medium text-gray-700">{email || 'votre adresse'}</span>.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="flex gap-2 justify-center mb-4" onPaste={handlePaste}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputsRef.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleDigit(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#34d399] transition"
                    />
                  ))}
                </div>

                <p className="text-center text-xs text-gray-400 mb-4">
                  {expireLeft > 0
                    ? <>Ce code expire dans <span className="font-medium text-gray-600">{fmt(expireLeft)}</span></>
                    : <span className="text-red-500">Ce code a expiré - renvoyez-en un nouveau</span>}
                </p>

                <button type="submit" disabled={loading || expireLeft <= 0}
                  className="w-full bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60">
                  {loading ? 'Vérification...' : 'Vérifier le code'}
                </button>
              </form>

              <div className="mt-5 text-center">
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || resending}
                  className="text-sm text-[#2d7a5f] hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed">
                  {resending
                    ? 'Envoi...'
                    : resendCooldown > 0
                      ? `Renvoyer un code (${resendCooldown}s)`
                      : 'Renvoyer un nouveau code'}
                </button>
              </div>

              <p className="text-center text-sm text-gray-400 mt-4">
                <Link to="/login" className="hover:underline">{'<- Retour à la connexion'}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
