import { useEffect, useState } from 'react'
import { Scale, AlertTriangle, MessageSquare } from 'lucide-react'
import api from '../services/api'
import ContactUserModal from '../components/ui/ContactUserModal'

export default function LitigesPage() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)
  const [note,    setNote]    = useState('')
  const [busy,    setBusy]    = useState(false)
  const [contact, setContact] = useState(null)

  const load = () => {
    setLoading(true)
    api.get('/contrats/litiges')
      .then(({ data }) => setItems(data.data ?? data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const resoudre = async () => {
    if (!modal) return
    setBusy(true)
    try {
      await api.put(`/contrats/${modal.contrat.id_contrat}/litige/resoudre`, { action: modal.action, note })
      setItems((v) => v.filter((x) => x.id_contrat !== modal.contrat.id_contrat))
      setModal(null); setNote('')
    } catch (e) {
      alert(e.response?.data?.error || 'Action impossible')
    } finally { setBusy(false) }
  }

  const partie = (c, role) =>
    role === 'vendeur'
      ? [c.vendeur_prenom, c.vendeur_nom].filter(Boolean).join(' ') || `#${c.id_vendeur ?? '?'}`
      : [c.acheteur_prenom, c.acheteur_nom].filter(Boolean).join(' ') || `#${c.id_acheteur ?? '?'}`

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Scale className="w-5 h-5 text-slate-500" />
        <p className="text-sm text-slate-400">{items.length} litige(s) en attente de traitement</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
          <Scale className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">Aucun litige en cours.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Contrat', 'Vendeur', 'Acheteur', 'Points', 'Ouvert par', 'Motif', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((c) => (
                <tr key={c.id_contrat} className="hover:bg-slate-50 transition align-top">
                  <td className="px-4 py-3 font-medium text-slate-800">#{c.id_contrat}</td>
                  <td className="px-4 py-3 text-slate-600">{partie(c, 'vendeur')}</td>
                  <td className="px-4 py-3 text-slate-600">{partie(c, 'acheteur')}</td>
                  <td className="px-4 py-3 text-slate-500">{c.points_echanges > 0 ? `${c.points_echanges} pts` : 'Gratuit'}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="text-slate-600 font-medium">
                      {[c.ouvreur_prenom, c.ouvreur_nom].filter(Boolean).join(' ') || '-'}
                    </span>
                    <div className="text-slate-400">
                      {c.date_litige ? `le ${new Date(c.date_litige).toLocaleDateString('fr-FR')}` : ''}
                    </div>
                    {c.litige_ouvert_par && (
                      <button
                        onClick={() => setContact({ id: c.litige_ouvert_par, prenom: c.ouvreur_prenom, nom: c.ouvreur_nom })}
                        className="mt-1 font-medium text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Contacter
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs">
                    <span className="line-clamp-3">{c.motif_litige || '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => { setNote(''); setModal({ contrat: c, action: 'rembourser' }) }}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline text-left">
                        Rembourser l'acheteur
                      </button>
                      <button onClick={() => { setNote(''); setModal({ contrat: c, action: 'clore' }) }}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline text-left">
                        Clore sans remboursement
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold text-slate-800">
                {modal.action === 'rembourser' ? 'Rembourser l\'acheteur' : 'Clore le litige'}
              </h3>
            </div>
            <p className="text-sm text-slate-500 mb-2">
              Contrat <strong>#{modal.contrat.id_contrat}</strong> — {partie(modal.contrat, 'vendeur')} → {partie(modal.contrat, 'acheteur')}
            </p>
            <p className="text-sm text-slate-600 mb-4">
              {modal.action === 'rembourser'
                ? <>Les <strong>{modal.contrat.points_echanges} points</strong> seront recrédités à l'acheteur (et repris au vendeur). Le contrat passera en « annulé ».</>
                : <>Le litige sera rejeté, le contrat reste « terminé » et aucun point n'est déplacé.</>}
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Note (optionnelle) communiquée aux deux parties"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-3">
              <button onClick={() => { setModal(null); setNote('') }} disabled={busy}
                className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50 transition disabled:opacity-50">
                Annuler
              </button>
              <button onClick={resoudre} disabled={busy}
                className={`flex-1 text-white py-2 rounded-lg text-sm transition disabled:opacity-50 ${
                  modal.action === 'rembourser' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-700 hover:bg-slate-800'
                }`}>
                {busy ? '...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {contact && <ContactUserModal user={contact} onClose={() => setContact(null)} />}
    </div>
  )
}
