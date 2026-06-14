import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import api from '../services/api'

const STATUT_LABELS  = { ouvert: 'Ouvert', en_cours: 'En cours', resolu: 'Résolu', ferme: 'Fermé' }
const STATUT_COLORS  = {
  ouvert:   'bg-red-100 text-red-700', en_cours: 'bg-yellow-100 text-yellow-700',
  resolu:   'bg-green-100 text-green-700', ferme: 'bg-slate-100 text-slate-500',
}
const PRIORITE_COLORS = {
  basse: 'bg-blue-50 text-blue-600', normale: 'bg-slate-100 text-slate-600',
  haute: 'bg-orange-100 text-orange-600', critique: 'bg-red-100 text-red-700',
}

const EMPTY_FORM = { titre: '', description: '', type: '', priorite: 'normale' }

export default function IncidentsPage() {
  const [incidents,  setIncidents]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState('all')
  const [confirm,    setConfirm]    = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState(null)

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
    try {
      await api.delete(`/incidents/${id}`)
      setIncidents((inc) => inc.filter((i) => (i.id ?? i._id) !== id))
    } catch {}
    setConfirm(null)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        titre:       form.titre,
        description: form.description || null,
        type:        form.type || null,
        priorite:    form.priorite,
      }
      const { data } = await api.post('/incidents', payload)
      setIncidents((v) => [data.data ?? data.incident ?? data, ...v])
      setShowCreate(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      setFormError(err.response?.data?.error ?? 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  const filtered = filter === 'all' ? incidents : incidents.filter((i) => i.statut === filter)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        {['all', 'ouvert', 'en_cours', 'resolu', 'ferme'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === s ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}>
            {s === 'all' ? 'Tous' : STATUT_LABELS[s]}
            {s !== 'all' && (
              <span className="ml-1.5 text-xs opacity-70">({incidents.filter((i) => i.statut === s).length})</span>
            )}
          </button>
        ))}
        <span className="text-sm text-slate-400 self-center">{filtered.length} incident(s)</span>
        <button onClick={() => { setShowCreate(true); setFormError(null); setForm(EMPTY_FORM) }}
          className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition">
          + Nouvel incident
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
          <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
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
                      {inc.created_at ? new Date(inc.created_at).toLocaleDateString('fr-FR') : '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select value={inc.statut ?? 'ouvert'} onChange={(e) => handleStatut(id, e.target.value)}
                      className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${STATUT_COLORS[inc.statut] ?? 'bg-slate-100'}`}>
                      {Object.entries(STATUT_LABELS).map(([val, lab]) => (
                        <option key={val} value={val}>{lab}</option>
                      ))}
                    </select>
                    <button onClick={() => setConfirm({ id, titre: inc.titre })}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5 rounded hover:bg-red-50 transition"></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal création */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="font-semibold text-slate-800 mb-4">Nouvel incident</h3>
            {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{formError}</p>}
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
                <input required value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                  <input value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    placeholder="voirie, éclairage..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Priorité</label>
                  <select value={form.priorite} onChange={(e) => setForm((f) => ({ ...f, priorite: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="basse">Basse</option>
                    <option value="normale">Normale</option>
                    <option value="haute">Haute</option>
                    <option value="critique">Critique</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50 transition">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm transition disabled:opacity-60">
                  {saving ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-slate-800 mb-2">Confirmer la suppression</h3>
            <p className="text-sm text-slate-500 mb-5">Supprimer <strong>{confirm.titre}</strong> ? Cette action est irréversible.</p>
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
