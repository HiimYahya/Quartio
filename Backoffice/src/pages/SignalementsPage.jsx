import { useEffect, useState } from 'react'
import { Flag } from 'lucide-react'
import api from '../services/api'

export default function SignalementsPage() {
  const [signalements, setSignalements] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [actionId,     setActionId]     = useState(null)
  const [confirm,      setConfirm]      = useState(null)

  const load = () => {
    api.get('/incidents', { params: { signalements: true, limit: 100 } })
      .then(({ data }) => setSignalements(data.data ?? []))
      .catch(() => setSignalements([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const removeFromList = (id) => setSignalements((s) => s.filter((i) => (i.id ?? i._id) !== id))

  const handleSupprimer = async (sig) => {
    const messageId = sig.id_message?._id ?? sig.id_message
    setActionId(sig._id)
    try {
      await api.delete(`/messages/${messageId}`)
      await api.put(`/incidents/${sig._id ?? sig.id}`, { statut: 'resolu' })
      removeFromList(sig._id ?? sig.id)
    } catch {
      // l'action échoue silencieusement, l'admin peut réessayer
    }
    setActionId(null)
    setConfirm(null)
  }

  const handleAvertir = async (sig) => {
    const messageId = sig.id_message?._id ?? sig.id_message
    setActionId(sig._id)
    try {
      await api.post(`/messages/${messageId}/avertir`)
      await api.put(`/incidents/${sig._id ?? sig.id}`, { statut: 'resolu' })
      removeFromList(sig._id ?? sig.id)
    } catch {
      // l'action échoue silencieusement, l'admin peut réessayer
    }
    setActionId(null)
  }

  const handleIgnorer = async (sig) => {
    setActionId(sig._id)
    try {
      await api.put(`/incidents/${sig._id ?? sig.id}`, { statut: 'ferme' })
      removeFromList(sig._id ?? sig.id)
    } catch {
      // l'action échoue silencieusement, l'admin peut réessayer
    }
    setActionId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-slate-800 text-lg">Messages signalés</h2>
        <span className="text-sm text-slate-400">{signalements.length} en attente</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement...</div>
      ) : signalements.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
          <Flag className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">Aucun message signalé à traiter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {signalements.map((sig) => {
            const id = sig._id ?? sig.id
            const msg = sig.id_message
            const auteur = sig.message_auteur
            const busy = actionId === id
            return (
              <div key={id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        Signalé
                      </span>
                      <span className="text-sm text-slate-700 font-medium">
                        {auteur ? `${auteur.prenom} ${auteur.nom}` : 'Utilisateur inconnu'}
                      </span>
                    </div>
                    {msg?.type === 'image' && msg?.media_url ? (
                      <img src={msg.media_url} alt="Image signalée" className="max-h-40 rounded-lg mt-1" />
                    ) : (
                      <p className="text-sm text-slate-600 italic">"{msg?.contenu || msg?.est_supprime && '[Message supprimé]' || '-'}"</p>
                    )}
                    {sig.description && (
                      <p className="text-xs text-slate-400 mt-1">Motif : {sig.description}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      Signalé le {new Date(sig.date_signalement ?? sig.createdAt).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setConfirm(sig)} disabled={busy}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-50">
                      Supprimer le message
                    </button>
                    <button onClick={() => handleAvertir(sig)} disabled={busy}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition disabled:opacity-50">
                      Avertir
                    </button>
                    <button onClick={() => handleIgnorer(sig)} disabled={busy}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition disabled:opacity-50">
                      Ignorer
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal confirmation suppression */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-slate-800 mb-2">Supprimer ce message ?</h3>
            <p className="text-sm text-slate-500 mb-5">
              Le message sera supprimé pour tous les participants de la conversation. Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)}
                className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50 transition">
                Annuler
              </button>
              <button onClick={() => handleSupprimer(confirm)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm transition">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
