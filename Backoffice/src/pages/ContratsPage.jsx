import { useEffect, useState } from 'react'
import api from '../services/api'

const STATUT_LABELS = { en_attente: 'En attente', signe: 'Signé', annule: 'Annulé', termine: 'Terminé' }
const STATUT_COLORS = {
  en_attente: 'bg-yellow-100 text-yellow-700',
  signe:      'bg-green-100 text-green-700',
  annule:     'bg-red-100 text-red-600',
  termine:    'bg-slate-100 text-slate-500',
}

export default function ContratsPage() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)

  const load = () => {
    api.get('/contrats')
      .then(({ data }) => setItems(data.data ?? data.contrats ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleStatut = async (id, statut) => {
    try {
      await api.put(`/contrats/${id}/statut`, { statut })
      setItems((v) => v.map((x) => x.id_contrat === id ? { ...x, statut } : x))
    } catch {}
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/contrats/${id}`)
      setItems((v) => v.filter((x) => x.id_contrat !== id))
    } catch {}
    setConfirm(null)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{items.length} contrat(s)</p>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
          <p className="text-slate-400">Aucun contrat.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Contrat', 'Points', 'Création', 'Signature', 'Statut', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((c) => (
                <tr key={c.id_contrat} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-medium text-slate-800">#{c.id_contrat}</td>
                  <td className="px-4 py-3 text-slate-500">{c.points_echanges > 0 ? `${c.points_echanges} pts` : 'Gratuit'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {c.date_creation ? new Date(c.date_creation).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {c.date_signature ? new Date(c.date_signature).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <select value={c.statut ?? 'en_attente'} onChange={(e) => handleStatut(c.id_contrat, e.target.value)}
                      className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${STATUT_COLORS[c.statut] ?? 'bg-slate-100'}`}>
                      {Object.entries(STATUT_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setConfirm({ id: c.id_contrat })}
                      className="text-xs text-red-500 hover:text-red-700 hover:underline">
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal suppression */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-slate-800 mb-2">Confirmer la suppression</h3>
            <p className="text-sm text-slate-500 mb-5">
              Supprimer le contrat <strong>#{confirm.id}</strong> ? Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)}
                className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50 transition">
                Annuler
              </button>
              <button onClick={() => handleDelete(confirm.id)}
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
