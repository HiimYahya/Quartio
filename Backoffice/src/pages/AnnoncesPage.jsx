import { useEffect, useState } from 'react'
import api from '../services/api'

const STATUT_COLORS = {
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-slate-100 text-slate-500',
  archivee: 'bg-purple-100 text-purple-600',
}

export default function AnnoncesPage() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')

  const load = () => {
    api.get('/annonces')
      .then(({ data }) => setItems(data.data ?? data.annonces ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleStatut = async (id, statut) => {
    try {
      await api.put(`/annonces/${id}`, { statut })
      setItems((v) => v.map((x) => (x.id ?? x._id) === id ? { ...x, statut } : x))
    } catch {}
  }

  const filtered = filter === 'all' ? items : items.filter((i) => i.statut === filter)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        {['all', 'active', 'inactive', 'archivee'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === s ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}>
            {s === 'all' ? 'Toutes' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <span className="ml-auto text-sm text-slate-400">{filtered.length} annonce(s)</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
          <p className="text-slate-400">Aucune annonce.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Annonce', 'Type', 'Prix', 'Statut', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((a) => {
                const id = a.id ?? a._id
                return (
                  <tr key={id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{a.titre}</p>
                      {a.categorie && <p className="text-xs text-slate-400">{a.categorie}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${a.type === 'offre' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {a.type ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {a.est_payant ? `${a.cout_points} pts` : 'Gratuit'}
                    </td>
                    <td className="px-4 py-3">
                      <select value={a.statut ?? 'active'} onChange={(e) => handleStatut(id, e.target.value)}
                        className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${STATUT_COLORS[a.statut] ?? 'bg-slate-100'}`}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="archivee">Archivée</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleStatut(id, 'archivee')} className="text-xs text-slate-400 hover:text-slate-600 hover:underline">
                        Archiver
                      </button>
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
