import { useState, useEffect } from 'react'
import { ShieldCheck, Lock, Mail, Phone, Monitor, LogOut } from 'lucide-react'
import api from '../../services/api'
import PasswordStrengthMeter from './PasswordStrengthMeter'
import { isPasswordValid, PASSWORD_RULES_MESSAGE } from '../../utils/passwordPolicy'

export default function SecuritySection({ user, onEmailChanged, onLogout }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[#2d7a5f]" />
        <div>
          <h3 className="font-semibold text-gray-800">Sécurité du compte</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Gérez votre mot de passe, votre email, votre téléphone et vos sessions actives.
          </p>
        </div>
      </div>

      <ChangePasswordForm user={user} onLogout={onLogout} />
      <hr className="border-gray-100" />
      <ChangeEmailForm user={user} onEmailChanged={onEmailChanged} />
      <hr className="border-gray-100" />
      <ChangeTelephoneForm user={user} />
      <hr className="border-gray-100" />
      <ActiveSessions user={user} onLogout={onLogout} />
    </div>
  )
}

function MfaCodeField({ value, onChange }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
        <ShieldCheck className="w-3.5 h-3.5 text-gray-400" /> Code MFA (application d'authentification)
      </label>
      <input
        type="text" inputMode="numeric" maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[#34d399]"
      />
    </div>
  )
}

function ChangePasswordForm({ user, onLogout }) {
  const [ancien, setAncien]   = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null); setSuccess(null)
    if (!isPasswordValid(nouveau)) return setError(PASSWORD_RULES_MESSAGE)
    if (nouveau !== confirm) return setError('Les mots de passe ne correspondent pas.')
    setLoading(true)
    try {
      await api.put(`/utilisateurs/${user.id}/password`, {
        ancien_mot_de_passe: ancien,
        nouveau_mot_de_passe: nouveau,
        ...(user?.mfa_actif ? { mfa_code: mfaCode } : {}),
      })
      setSuccess('Mot de passe modifié. Vous allez être déconnecté.')
      setTimeout(() => onLogout?.(), 1500)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Erreur lors du changement de mot de passe')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Changer le mot de passe</h4>
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-sm">{success}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="password" value={ancien} onChange={(e) => setAncien(e.target.value)}
          placeholder="Mot de passe actuel"
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]" />
      </div>
      <div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)}
            placeholder="Nouveau mot de passe"
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]" />
        </div>
        <PasswordStrengthMeter password={nouveau} />
      </div>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirmer le nouveau mot de passe"
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]" />
      </div>
      {user?.mfa_actif && <MfaCodeField value={mfaCode} onChange={setMfaCode} />}
      <button type="submit" disabled={loading || !ancien || !nouveau || !confirm}
        className="bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-60">
        {loading ? 'Modification...' : 'Changer le mot de passe'}
      </button>
    </form>
  )
}

function ChangeEmailForm({ user, onEmailChanged }) {
  const [email, setEmail]     = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null); setSuccess(null)
    setLoading(true)
    try {
      await api.put(`/utilisateurs/${user.id}/email`, {
        nouvel_email: email,
        ...(user?.mfa_actif ? { mfa_code: mfaCode } : {}),
      })
      setSuccess('Email modifié. Un code de vérification vous a été envoyé à la nouvelle adresse.')
      setEmail(''); setMfaCode('')
      onEmailChanged?.()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Erreur lors du changement d\'email')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Changer l'email</h4>
      <p className="text-xs text-gray-400">Email actuel : {user?.email}</p>
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-sm">{success}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Nouvel email"
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]" />
      </div>
      {user?.mfa_actif && <MfaCodeField value={mfaCode} onChange={setMfaCode} />}
      <button type="submit" disabled={loading || !email}
        className="bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-60">
        {loading ? 'Modification...' : 'Changer l\'email'}
      </button>
    </form>
  )
}

function ChangeTelephoneForm({ user }) {
  const [telephone, setTelephone] = useState(user?.telephone ?? '')
  const [mfaCode, setMfaCode]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null); setSuccess(null)
    if (telephone && !/^\+?[0-9][0-9 ()./-]{5,18}$/.test(telephone)) {
      return setError('Numéro de téléphone invalide (chiffres, espaces, + . - ( ) acceptés)')
    }
    setLoading(true)
    try {
      await api.put(`/utilisateurs/${user.id}/telephone`, {
        telephone,
        ...(user?.mfa_actif ? { mfa_code: mfaCode } : {}),
      })
      setSuccess('Téléphone modifié.')
      setMfaCode('')
    } catch (err) {
      setError(err.response?.data?.error ?? 'Erreur lors du changement de téléphone')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Changer le téléphone</h4>
      {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-sm">{success}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="tel" value={telephone ?? ''} onChange={(e) => setTelephone(e.target.value)}
          placeholder="Numéro de téléphone" maxLength={20}
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]" />
      </div>
      {user?.mfa_actif && <MfaCodeField value={mfaCode} onChange={setMfaCode} />}
      <button type="submit" disabled={loading}
        className="bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-60">
        {loading ? 'Modification...' : 'Enregistrer'}
      </button>
    </form>
  )
}

function ActiveSessions({ user, onLogout }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [revoking, setRevoking] = useState(false)
  const [error, setError]       = useState(null)

  useEffect(() => {
    if (!user?.id) return
    api.get(`/utilisateurs/${user.id}/sessions`)
      .then(({ data }) => setSessions(data ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [user?.id])

  const handleRevokeAll = async () => {
    setRevoking(true); setError(null)
    try {
      await api.delete(`/utilisateurs/${user.id}/sessions`)
      onLogout?.()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Erreur lors de la déconnexion des sessions')
      setRevoking(false)
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Sessions actives</h4>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
      {loading ? (
        <p className="text-sm text-gray-400">Chargement...</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-gray-400">Aucune session active.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
              <span className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-gray-400 shrink-0" />
                Session ouverte le {new Date(s.cree_le).toLocaleString('fr-FR')}
              </span>
              <span className="text-xs text-gray-400">Expire le {new Date(s.expire_le).toLocaleDateString('fr-FR')}</span>
            </div>
          ))}
        </div>
      )}
      <button onClick={handleRevokeAll} disabled={revoking || sessions.length === 0}
        className="flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-60">
        <LogOut className="w-4 h-4" />
        {revoking ? 'Déconnexion...' : 'Déconnecter toutes les sessions'}
      </button>
    </div>
  )
}
