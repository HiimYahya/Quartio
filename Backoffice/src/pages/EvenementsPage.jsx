import { useEffect, useState } from 'react'
import api from '../services/api'

const STATUT_COLORS = {
  planifie: 'bg-blue-100 text-blue-700', en_cours: 'bg-green-100 text-green-700',
  termine: 'bg-slate-100 text-slate-500', annule: 'bg-red-100 text-red-600',
}

export default function EvenementsPage() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    api.get('/evenements')
      .then(({ data }) => setItems(data.data ?? data.evenements ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleStatut = async (id, statut) => {
    try {
      await api.put(`/evenements/${id}`, { statut })
      setItems((v) => v.map((x) => (x.id ?? x._id) === id ? { ...x, statut } : x))
    } catch {}
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet événement ?')) return
    try {
      await api.delete(`/evenements/${id}`)
      setItems((v) => v.filter((x) => (x.id ?? x._id) !== id))
    } catch {}
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{items.length} événement(s)</p>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
          <p className="text-slate-400">Aucun événement.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Événement', 'Date', 'Lieu', 'Capacité', 'Statut', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((ev) => {
                const id = ev.id ?? ev._id
                return (
                  <tr key={id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{ev.titre}</p>
                      {ev.description && <p className="text-xs text-slate-400 truncate max-w-xs">{ev.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {ev.date_debut ? new Date(ev.date_debut).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-24">{ev.lieu ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{ev.capacite_max ?? '∞'}</td>
                    <td className="px-4 py-3">
                      <select value={ev.statut ?? 'planifie'} onChange={(e) => handleStatut(id, e.target.value)}
                        className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${STATUT_COLORS[ev.statut] ?? 'bg-slate-100'}`}>
                        <option value="planifie">Planifié</option>
                        <option value="en_cours">En cours</option>
                        <option value="termine">Terminé</option>
                        <option value="annule">Annulé</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(id)} className="text-xs text-red-500 hover:underline">Supprimer</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
