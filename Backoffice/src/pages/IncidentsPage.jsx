import { useEffect, useState } from 'react'
import api from '../services/api'

const STATUT_LABELS = { ouvert: 'Ouvert', en_cours: 'En cours', resolu: 'Résolu', ferme: 'Fermé' }
const STATUT_COLORS = {
  ouvert:   'bg-red-100 text-red-700',
  en_cours: 'bg-yellow-100 text-yellow-700',
  resolu:   'bg-green-100 text-green-700',
  ferme:    'bg-slate-100 text-slate-500',
}
const PRIORITE_COLORS = {
  basse: 'bg-blue-50 text-blue-600', normale: 'bg-slate-100 text-slate-600',
  haute: 'bg-orange-100 text-orange-600', critique: 'bg-red-100 text-red-700',
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('all')

  const load = () => {
    api.get('/incidents')
      .then(({ data }) => setIncidents(data.data ?? data.incidents ?? []))
      .catch(() => setIncidents([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleStatut = async (id, statut) => {
    try {
      await api.put(`/incidents/${id}`, { statut })
      setIncidents((inc) => inc.map((i) => (i.id ?? i._id) === id ? { ...i, statut } : i))
    } catch {}
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet incident ?')) return
    try {
      await api.delete(`/incidents/${id}`)
      setIncidents((inc) => inc.filter((i) => (i.id ?? i._id) !== id))
    } catch {}
  }

  const filtered = filter === 'all' ? incidents : incidents.filter((i) => i.statut === filter)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {['all', 'ouvert', 'en_cours', 'resolu', 'ferme'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === s ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}>
            {s === 'all' ? 'Tous' : STATUT_LABELS[s]}
            {s !== 'all' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({incidents.filter((i) => i.statut === s).length})
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto text-sm text-slate-400 self-center">{filtered.length} incident(s)</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-slate-400">Aucun incident dans cette catégorie.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inc) => {
            const id = inc.id ?? inc._id
            return (
              <div key={id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-800 truncate">{inc.titre}</h4>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${PRIORITE_COLORS[inc.priorite] ?? 'bg-slate-100 text-slate-600'}`}>
                        {inc.priorite ?? 'normale'}
                      </span>
                    </div>
                    {inc.description && <p className="text-sm text-slate-500 line-clamp-2">{inc.description}</p>}
                    <p className="text-xs text-slate-400 mt-1">
                      {inc.created_at ? new Date(inc.created_at).toLocaleDateString('fr-FR') : '—'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select value={inc.statut ?? 'ouvert'}
                      onChange={(e) => handleStatut(id, e.target.value)}
                      className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${STATUT_COLORS[inc.statut] ?? 'bg-slate-100'}`}>
                      {Object.entries(STATUT_LABELS).map(([val, lab]) => (
                        <option key={val} value={val}>{lab}</option>
                      ))}
                    </select>
                    <button onClick={() => handleDelete(id)}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5 rounded hover:bg-red-50 transition">
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
