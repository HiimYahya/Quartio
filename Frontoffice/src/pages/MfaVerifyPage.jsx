import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import useAuthStore from '../store/authStore'

export default function MfaVerifyPage() {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError]   = useState(null)
  const [loading, setLoading] = useState(false)
  const inputsRef = useRef([])
  const navigate  = useNavigate()
  const { verifyMfa, mfaToken } = useAuthStore()

  useEffect(() => {
    // Si on arrive ici sans mfa_token en store, on redirige
    if (!mfaToken) navigate('/login', { replace: true })
    else inputsRef.current[0]?.focus()
  }, [mfaToken])

  const handleDigit = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]; next[i] = val; setDigits(next); setError(null)
    if (val && i < 5) inputsRef.current[i + 1]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputsRef.current[i - 1]?.focus()
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
    if (code.length < 6) return setError('Entrez les 6 chiffres')
    setLoading(true); setError(null)
    const ok = await verifyMfa(code)
    if (ok) navigate('/dashboard')
    else setError(useAuthStore.getState().error || 'Code invalide')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#1a4a3a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#34d399] rounded-2xl flex items-center justify-center text-[#1a4a3a] font-bold text-3xl mx-auto mb-4">Q</div>
          <h1 className="text-3xl font-bold text-white">Quartio</h1>
          <p className="text-white/60 mt-1">Authentification à deux facteurs</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <ShieldCheck className="w-10 h-10 text-[#1a4a3a] mx-auto mb-2" />
            <h2 className="text-xl font-semibold text-gray-800">Code d'authentification</h2>
            <p className="text-sm text-gray-500 mt-1">Entrez le code à 6 chiffres de votre application d'authentification.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
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

            <button type="submit" disabled={loading}
              className="w-full bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60">
              {loading ? 'Vérification...' : 'Vérifier'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-5">
            <Link to="/login" className="hover:underline">{'<- Retour à la connexion'}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
