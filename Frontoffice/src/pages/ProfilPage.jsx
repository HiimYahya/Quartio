import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Coins, MapPin, Info, CheckCircle2, AlertCircle, Download } from 'lucide-react'
import useAuthStore from '../store/authStore'
import api from '../services/api'
import LangSwitcher from '../components/ui/LangSwitcher'
import MfaSection from '../components/ui/MfaSection'
import SecuritySection from '../components/ui/SecuritySection'

export default function ProfilPage() {
  const { user, fetchMe, logout } = useAuthStore()
  const { t } = useTranslation()
  const [form, setForm]       = useState({ nom: user?.nom ?? '', prenom: user?.prenom ?? '', email: user?.email ?? '' })
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState(null)
  const [transactions, setTransactions] = useState([])
  const [txLoading, setTxLoading]       = useState(true)

  // ── Quartier ──────────────────────────────────────────────────────────────
  const [quartier,       setQuartier]       = useState(null)   // quartier actuel
  const [qLoading,       setQLoading]       = useState(true)
  const [adresse,        setAdresse]        = useState('')
  const [detecting,      setDetecting]      = useState(false)
  const [detectResult,   setDetectResult]   = useState(null)  // { type: 'success'|'error', message }


  useEffect(() => {
    api.get('/transactions')
      .then(({ data }) => setTransactions(data.data ?? data.transactions ?? []))
      .catch(() => setTransactions([]))
      .finally(() => setTxLoading(false))
  }, [])

  // Charge le quartier actuel de l'utilisateur
  useEffect(() => {
    if (!user?.id) return
    api.get(`/utilisateurs/${user.id}/quartiers`)
      .then(({ data }) => setQuartier(data[0] ?? null))
      .catch(() => setQuartier(null))
      .finally(() => setQLoading(false))
  }, [user?.id])

  const handleDetect = async (e) => {
    e.preventDefault()
    if (!adresse.trim()) return
    setDetecting(true)
    setDetectResult(null)
    try {
      const { data } = await api.post(`/utilisateurs/${user.id}/quartier/detect`, { adresse })
      setQuartier(data.quartier)
      setDetectResult({ type: 'success', message: `Vous avez été assigné au quartier "${data.quartier.nom}"` })
      setAdresse('')
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Erreur lors de la détection'
      setDetectResult({ type: 'error', message: msg })
    } finally {
      setDetecting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(null); setSuccess(false)
    try {
      await api.put(`/utilisateurs/${user.id}`, form)
      await fetchMe()
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.error ?? t('common.error'))
    }
    setSaving(false)
  }

  return (
    <div className="max-w-2xl space-y-5">

      {/* Solde points */}
      <div className="bg-gradient-to-r from-[#1a4a3a] to-[#2d7a5f] rounded-2xl p-6 text-white flex items-center justify-between">
        <div>
          <p className="text-white/60 text-sm mb-1">{t('profile.balance')}</p>
          <p className="text-4xl font-bold">
            {user?.points_solde ?? '-'}
            <span className="text-xl font-normal text-white/70 ml-2">{t('common.pts')}</span>
          </p>
          <p className="text-white/50 text-xs mt-2">{t('profile.balanceHint')}</p>
        </div>
        <Coins className="w-12 h-12 text-white/30" />
      </div>

      {/* Mon quartier */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">Mon quartier</h3>

        {/* Quartier actuel */}
        {qLoading ? (
          <p className="text-sm text-gray-400">Chargement...</p>
        ) : quartier ? (
          <div className="flex items-center gap-3 bg-[#f0faf5] rounded-xl px-4 py-3">
            <MapPin className="w-5 h-5 text-[#1a4a3a] shrink-0" />
            <div>
              <p className="font-semibold text-[#1a4a3a]">{quartier.nom}</p>
              <p className="text-xs text-gray-500">Votre quartier actuel</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-500">
            <Info className="w-5 h-5 shrink-0" />
            Vous n'êtes rattaché à aucun quartier pour le moment.
          </div>
        )}

        {/* Formulaire de détection par adresse */}
        <form onSubmit={handleDetect} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {quartier ? 'Changer de quartier via mon adresse' : 'Trouver mon quartier via mon adresse'}
            </label>
            <input
              value={adresse}
              onChange={(e) => { setAdresse(e.target.value); setDetectResult(null) }}
              placeholder="Ex: 12 rue de Rivoli, Paris"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]"
            />
            <p className="text-xs text-gray-400 mt-1">
              Saisissez votre adresse complète. Elle sera comparée aux zones définies sur la carte.
            </p>
          </div>

          {/* Résultat de la détection */}
          {detectResult && (
            <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
              detectResult.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {detectResult.type === 'success'
                ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                : <AlertCircle className="w-4 h-4 shrink-0" />}
              {detectResult.message}
            </div>
          )}

          <button
            type="submit"
            disabled={detecting || !adresse.trim()}
            className="w-full bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm"
          >
            {detecting ? 'Recherche en cours...' : 'Trouver mon quartier'}
          </button>
        </form>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">{t('profile.txHistory')}</h3>
        {txLoading ? (
          <p className="text-sm text-gray-400 text-center py-4">{t('common.loading')}</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">{t('profile.noTx')}</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id_transaction} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm text-gray-700">{tx.motif ?? t('profile.transaction')}</p>
                  <p className="text-xs text-gray-400">
                    {tx.date ? new Date(tx.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                  </p>
                </div>
                <span className={`font-semibold text-sm ${tx.montant >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.montant >= 0 ? '+' : ''}{tx.montant} {t('common.pts')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulaire profil */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-[#1a4a3a] rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0">
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">{user?.prenom} {user?.nom}</h2>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className="bg-[#1a4a3a]/10 text-[#1a4a3a] text-xs font-medium px-2 py-0.5 rounded-full capitalize">
              {user?.role ?? t('common.resident')}
            </span>
          </div>
        </div>

        {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-4 text-sm">{t('profile.saved')}</div>}
        {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.firstName')}</label>
              <input value={form.prenom} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.lastName')}</label>
              <input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.email')}</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60">
            {saving ? t('profile.saving') : t('profile.save')}
          </button>
        </form>
      </div>

      {/* Sécurité - MFA */}
      <MfaSection user={user} onStatusChange={fetchMe} />

      {/* Sécurité - mot de passe, email, téléphone, sessions */}
      <SecuritySection user={user} onEmailChanged={fetchMe} onLogout={logout} />

      {/* Langue */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Langue / Language</h3>
        <LangSwitcher />
      </div>

      {/* RGPD */}
      <RgpdSection user={user} onDelete={logout} />

      <button onClick={logout}
        className="w-full border border-red-200 text-red-600 hover:bg-red-50 font-medium py-2.5 rounded-xl transition-colors text-sm">
        {t('profile.logout')}
      </button>
    </div>
  )
}

function RgpdSection({ user, onDelete }) {
  const [deleteStep, setDeleteStep] = useState(null) // null | 'confirm' | 'verify'
  const [credential, setCredential] = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  const handleExport = async () => {
    try {
      const res = await api.get('/rgpd/export', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }))
      const a   = document.createElement('a')
      a.href     = url
      a.download = `quartio-mes-donnees-${user?.id}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* silencieux - l'utilisateur verra l'absence de téléchargement */ }
  }

  const handleDelete = async (e) => {
    e.preventDefault()
    if (!credential.trim()) return setError('Veuillez entrer votre ' + (user?.mfa_actif ? 'code MFA' : 'mot de passe'))
    setLoading(true); setError(null)
    try {
      const body = user?.mfa_actif
        ? { code: credential }
        : { mot_de_passe: credential }
      await api.delete('/rgpd/delete-account', { data: body })
      onDelete?.()
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la suppression')
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
      <h3 className="font-semibold text-gray-800">Mes données (RGPD)</h3>
      <p className="text-xs text-gray-500">
        Conformément au RGPD, vous pouvez accéder à toutes vos données ou demander la suppression de votre compte.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <button
        onClick={handleExport}
        className="w-full border border-[#1a4a3a] text-[#1a4a3a] hover:bg-[#f0faf5] font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
      >
        <Download className="w-4 h-4" />
        Exporter mes données (JSON)
      </button>

      {deleteStep === null && (
        <button
          onClick={() => { setDeleteStep('confirm'); setError(null) }}
          className="w-full border border-red-300 text-red-600 hover:bg-red-50 font-medium py-2.5 rounded-lg text-sm transition-colors"
        >
          Supprimer mon compte
        </button>
      )}

      {deleteStep === 'confirm' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-red-700">Cette action est irréversible</p>
          <p className="text-xs text-red-600">
            Toutes vos données personnelles seront supprimées définitivement.
            Vos messages seront anonymisés. Vos contrats seront conservés sans votre identité (obligation légale).
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setDeleteStep(null)}
              className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-2 rounded-lg text-sm"
            >
              Annuler
            </button>
            <button
              onClick={() => setDeleteStep('verify')}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg text-sm"
            >
              Continuer
            </button>
          </div>
        </div>
      )}

      {deleteStep === 'verify' && (
        <form onSubmit={handleDelete} className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            {user?.mfa_actif
              ? 'Entrez votre code MFA pour confirmer'
              : 'Entrez votre mot de passe pour confirmer'}
          </label>
          <input
            type={user?.mfa_actif ? 'text' : 'password'}
            inputMode={user?.mfa_actif ? 'numeric' : undefined}
            maxLength={user?.mfa_actif ? 6 : undefined}
            value={credential}
            onChange={(e) => { setCredential(e.target.value); setError(null) }}
            placeholder={user?.mfa_actif ? '123456' : '--------'}
            className="w-full border border-red-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setDeleteStep(null); setCredential('') }}
              className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-2 rounded-lg text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-60"
            >
              {loading ? 'Suppression...' : 'Supprimer définitivement'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
