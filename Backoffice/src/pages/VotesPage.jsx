import { useEffect, useState } from 'react'
import { Vote } from 'lucide-react'
import api from '../services/api'

const STATUT_COLORS = {
  ouvert:  'bg-green-100 text-green-700',
  ferme:   'bg-slate-100 text-slate-500',
  archive: 'bg-purple-100 text-purple-600',
}

const EMPTY_FORM = { titre: '', description: '', type: '', date_debut: '', date_fin: '', est_anonyme: false, options: [{ libelle: '' }, { libelle: '' }] }

export default function VotesPage() {
  const [votes,      setVotes]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [confirm,    setConfirm]    = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState(null)

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
    try {
      await api.delete(`/votes/${id}`)
      setVotes((v) => v.filter((x) => (x.id ?? x._id) !== id))
    } catch {}
    setConfirm(null)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    const validOptions = form.options.filter((o) => o.libelle.trim())
    if (validOptions.length < 2) {
      setFormError('Au moins 2 options sont requises.')
      setSaving(false)
      return
    }
    try {
      const payload = {
        titre:       form.titre,
        description: form.description || null,
        type:        form.type || null,
        date_debut:  form.date_debut || null,
        date_fin:    form.date_fin || null,
        est_anonyme: form.est_anonyme,
        options:     validOptions.map((o, i) => ({ libelle: o.libelle, ordre: i })),
      }
      const { data } = await api.post('/votes', payload)
      setVotes((v) => [data.data ?? data.vote ?? data, ...v])
      setShowCreate(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      setFormError(err.response?.data?.error ?? 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  const setOption = (i, value) => setForm((f) => {
    const options = [...f.options]
    options[i] = { libelle: value }
    return { ...f, options }
  })

  const addOption    = () => setForm((f) => ({ ...f, options: [...f.options, { libelle: '' }] }))
  const removeOption = (i) => setForm((f) => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{votes.length} vote(s)</p>
        <button onClick={() => { setShowCreate(true); setFormError(null); setForm(EMPTY_FORM) }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition">
          + Nouveau vote
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement...</div>
      ) : votes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
          <Vote className="w-8 h-8 text-slate-300 mx-auto mb-3" />
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
                      {v.date_debut ? new Date(v.date_debut).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setConfirm({ id, titre: v.titre })} className="text-xs text-red-500 hover:underline">Supprimer</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal création */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-800 mb-4">Nouveau vote</h3>
            {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{formError}</p>}
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
                <input required value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date début</label>
                  <input type="datetime-local" value={form.date_debut} onChange={(e) => setForm((f) => ({ ...f, date_debut: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date fin</label>
                  <input type="datetime-local" value={form.date_fin} onChange={(e) => setForm((f) => ({ ...f, date_fin: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={form.est_anonyme} onChange={(e) => setForm((f) => ({ ...f, est_anonyme: e.target.checked }))}
                  className="rounded" />
                Vote anonyme
              </label>

              {/* Options dynamiques */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Options * (min. 2)</label>
                <div className="space-y-2">
                  {form.options.map((opt, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={opt.libelle} onChange={(e) => setOption(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      {form.options.length > 2 && (
                        <button type="button" onClick={() => removeOption(i)}
                          className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addOption}
                  className="mt-2 text-xs text-indigo-600 hover:underline">
                  + Ajouter une option
                </button>
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
