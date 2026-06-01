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
                {['Contrat', 'Points', 'Création', 'Signature', 'Statut'].map((h) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
