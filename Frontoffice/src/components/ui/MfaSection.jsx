import { useState, useRef } from 'react'
import api from '../../services/api'

export default function MfaSection({ user, onStatusChange }) {
  const [step, setStep]     = useState('idle') // idle | setup | activate | disable
  const [qrCode, setQrCode] = useState(null)
  const [secret, setSecret] = useState(null)
  const [code, setCode]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)
  const [success, setSuccess] = useState(null)
  const codeRef = useRef()

  const mfaActive = user?.mfa_actif

  const startSetup = async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await api.get('/auth/mfa/setup')
      setQrCode(data.qr_code)
      setSecret(data.secret)
      setStep('setup')
    } catch (e) { setError(e.response?.data?.error || 'Erreur') }
    setLoading(false)
  }

  const activate = async (e) => {
    e.preventDefault()
    if (code.length !== 6) return setError('Code à 6 chiffres requis')
    setLoading(true); setError(null)
    try {
      await api.post('/auth/mfa/activate', { code })
      setSuccess('MFA activé avec succès !')
      setStep('idle'); setCode('')
      onStatusChange?.()
    } catch (e) { setError(e.response?.data?.error || 'Code invalide') }
    setLoading(false)
  }

  const disable = async (e) => {
    e.preventDefault()
    if (code.length !== 6) return setError('Code à 6 chiffres requis')
    setLoading(true); setError(null)
    try {
      await api.post('/auth/mfa/disable', { code })
      setSuccess('MFA désactivé.')
      setStep('idle'); setCode('')
      onStatusChange?.()
    } catch (e) { setError(e.response?.data?.error || 'Code invalide') }
    setLoading(false)
  }

  const cancel = () => { setStep('idle'); setCode(''); setError(null); setQrCode(null); setSecret(null) }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Authentification à deux facteurs (MFA)</h3>
          <p className="text-xs text-gray-500 mt-0.5">Sécurisez votre compte avec Google Authenticator ou Authy.</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${mfaActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {mfaActive ? '✓ Activé' : 'Désactivé'}
        </span>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          ✅ {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* ── État idle ─────────────────────────────────────────────────────────── */}
      {step === 'idle' && (
        <div>
          {!mfaActive ? (
            <button onClick={startSetup} disabled={loading}
              className="w-full bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60">
              {loading ? 'Chargement…' : 'Activer le MFA'}
            </button>
          ) : (
            <button onClick={() => { setStep('disable'); setError(null); setSuccess(null); setTimeout(() => codeRef.current?.focus(), 100) }}
              className="w-full border border-red-200 text-red-600 hover:bg-red-50 font-medium py-2.5 rounded-lg text-sm transition-colors">
              Désactiver le MFA
            </button>
          )}
        </div>
      )}

      {/* ── Étape setup : affichage QR code ──────────────────────────────────── */}
      {step === 'setup' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            1. Scannez ce QR code avec <strong>Google Authenticator</strong> ou <strong>Authy</strong>.
          </p>
          {qrCode && (
            <div className="flex justify-center">
              <img src={qrCode} alt="QR code MFA" className="w-48 h-48 border border-gray-200 rounded-xl p-2" />
            </div>
          )}
          {secret && (
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Ou saisir manuellement :</p>
              <p className="font-mono text-sm font-bold tracking-widest text-gray-800 break-all">{secret}</p>
            </div>
          )}
          <p className="text-sm text-gray-600">
            2. Entrez le code à 6 chiffres affiché par l'application pour confirmer.
          </p>
          <form onSubmit={activate} className="space-y-3">
            <input
              ref={codeRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(null) }}
              placeholder="123456"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[#34d399]"
            />
            <div className="flex gap-2">
              <button type="button" onClick={cancel}
                className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-2.5 rounded-lg text-sm">
                Annuler
              </button>
              <button type="submit" disabled={loading || code.length !== 6}
                className="flex-1 bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60">
                {loading ? 'Activation…' : 'Activer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Étape disable : saisie code pour confirmation ─────────────────── */}
      {step === 'disable' && (
        <form onSubmit={disable} className="space-y-3">
          <p className="text-sm text-gray-600">
            Entrez le code de votre application d'authentification pour désactiver le MFA.
          </p>
          <input
            ref={codeRef}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(null) }}
            placeholder="123456"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <div className="flex gap-2">
            <button type="button" onClick={cancel}
              className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-2.5 rounded-lg text-sm">
              Annuler
            </button>
            <button type="submit" disabled={loading || code.length !== 6}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60">
              {loading ? 'Désactivation…' : 'Désactiver'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
