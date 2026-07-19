import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import useAuthStore from '../store/authStore'

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', mot_de_passe: '' })
  const [step, setStep] = useState('login')
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const { login, verifyMfa, loading, error, clearError } = useAuthStore()
  const navigate = useNavigate()
  const inputsRef = useRef([])

  useEffect(() => {
    if (step === 'mfa') inputsRef.current[0]?.focus()
  }, [step])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await login(form.email, form.mot_de_passe)
    if (result === true) navigate('/dashboard')
    else if (result?.mfaRequired) setStep('mfa')
  }

  const handleDigit = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]; next[i] = val; setDigits(next); clearError()
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

  const handleMfaSubmit = async (e) => {
    e.preventDefault()
    const code = digits.join('')
    if (code.length < 6) return
    const ok = await verifyMfa(code)
    if (ok) navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">Q</div>
          <h1 className="text-2xl font-bold text-white">Quartio</h1>
          <p className="text-slate-400 mt-1 text-sm">Interface d'administration</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {step === 'login' ? (
            <>
              <h2 className="text-lg font-semibold text-slate-800 mb-5">Connexion administrateur</h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" value={form.email} required placeholder="admin@quartio.fr"
                    onChange={(e) => { clearError(); setForm((f) => ({ ...f, email: e.target.value })) }}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
                  <input type="password" value={form.mot_de_passe} required placeholder="--------"
                    onChange={(e) => { clearError(); setForm((f) => ({ ...f, mot_de_passe: e.target.value })) }}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60 mt-1">
                  {loading ? 'Connexion...' : 'Se connecter'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <ShieldCheck className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                <h2 className="text-lg font-semibold text-slate-800">Code d'authentification</h2>
                <p className="text-sm text-slate-500 mt-1">Entrez le code à 6 chiffres de votre application d'authentification.</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
              )}

              <form onSubmit={handleMfaSubmit}>
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
                      className="w-12 h-14 text-center text-2xl font-bold border-2 border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500 transition"
                    />
                  ))}
                </div>

                <button type="submit" disabled={loading || digits.join('').length < 6}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60">
                  {loading ? 'Vérification...' : 'Vérifier'}
                </button>
              </form>

              <button onClick={() => { setStep('login'); setDigits(['', '', '', '', '', '']); clearError() }}
                className="w-full text-center text-sm text-slate-400 hover:underline mt-4">
                {'<- Retour à la connexion'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
