import { useEffect, useState } from 'react'
import api from '../services/api'

const STATUT_COLORS = {
  ouvert:  'bg-green-100 text-green-700',
  ferme:   'bg-slate-100 text-slate-500',
  archive: 'bg-purple-100 text-purple-600',
}

export default function VotesPage() {
  const [votes,   setVotes]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    api.get('/votes')
      .then(({ data }) => setVotes(data.data ?? data.votes ?? []))
      .catch(() => setVotes([]))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleStatut = async (id, statut) => {
    try {
      await api.put(`/votes/${id}`, { statut })
      setVotes((v) => v.map((x) => (x.id ?? x._id) === id ? { ...x, statut } : x))
    } catch {}
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce vote ?')) return
    try {
      await api.delete(`/votes/${id}`)
      setVotes((v) => v.filter((x) => (x.id ?? x._id) !== id))
    } catch {}
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{votes.length} vote(s)</p>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement…</div>
      ) : votes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
          <p className="text-slate-400">Aucun vote.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Titre', 'Options', 'Statut', 'Dates', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {votes.map((v) => {
                const id = v.id ?? v._id
                return (
                  <tr key={id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{v.titre}</p>
                      {v.description && <p className="text-xs text-slate-400 truncate max-w-xs">{v.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{v.options?.length ?? 0} options</td>
                    <td className="px-4 py-3">
                      <select value={v.statut ?? 'ouvert'} onChange={(e) => handleStatut(id, e.target.value)}
                        className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${STATUT_COLORS[v.statut] ?? 'bg-slate-100'}`}>
                        <option value="ouvert">Ouvert</option>
                        <option value="ferme">Fermé</option>
                        <option value="archive">Archivé</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {v.date_debut ? new Date(v.date_debut).toLocaleDateString('fr-FR') : '—'}
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
