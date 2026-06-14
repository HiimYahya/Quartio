import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import api from '../services/api'

const STATUT_COLORS = {
  planifie: 'bg-blue-100 text-blue-700', en_cours: 'bg-green-100 text-green-700',
  termine:  'bg-slate-100 text-slate-500', annule: 'bg-red-100 text-red-600',
}

const EMPTY_FORM = { titre: '', description: '', type: '', date_debut: '', date_fin: '', lieu: '', capacite_max: '', id_quartier: '' }

export default function EvenementsPage() {
  const [items,      setItems]      = useState([])
  const [quartiers,  setQuartiers]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [confirm,    setConfirm]    = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState(null)

  const load = () => {
    api.get('/evenements')
      .then(({ data }) => setItems(data.data ?? data.evenements ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    api.get('/quartiers').then(({ data }) => setQuartiers(data.data ?? data.quartiers ?? [])).catch(() => {})
  }, [])

  const handleStatut = async (id, statut) => {
    try {
      await api.put(`/evenements/${id}`, { statut })
      setItems((v) => v.map((x) => (x.id ?? x._id) === id ? { ...x, statut } : x))
    } catch {}
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/evenements/${id}`)
      setItems((v) => v.filter((x) => (x.id ?? x._id) !== id))
    } catch {}
    setConfirm(null)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        titre:        form.titre,
        description:  form.description || null,
        type:         form.type || null,
        date_debut:   form.date_debut,
        date_fin:     form.date_fin || null,
        lieu:         form.lieu || null,
        capacite_max: form.capacite_max ? Number(form.capacite_max) : null,
        id_quartier:  Number(form.id_quartier),
      }
      const { data } = await api.post('/evenements', payload)
      setItems((v) => [data.data ?? data.evenement ?? data, ...v])
      setShowCreate(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      setFormError(err.response?.data?.error ?? 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{items.length} événement(s)</p>
        <button onClick={() => { setShowCreate(true); setFormError(null); setForm(EMPTY_FORM) }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition">
          + Nouvel événement
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
          <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-3" />
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
                      {ev.date_debut ? new Date(ev.date_debut).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-24">{ev.lieu ?? '-'}</td>
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
                      <button onClick={() => setConfirm({ id, titre: ev.titre })} className="text-xs text-red-500 hover:underline">Supprimer</button>
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
            <h3 className="font-semibold text-slate-800 mb-4">Nouvel événement</h3>
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
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date début *</label>
                  <input required type="datetime-local" value={form.date_debut} onChange={(e) => setForm((f) => ({ ...f, date_debut: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date fin</label>
                  <input type="datetime-local" value={form.date_fin} onChange={(e) => setForm((f) => ({ ...f, date_fin: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Lieu</label>
                  <input value={form.lieu} onChange={(e) => setForm((f) => ({ ...f, lieu: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Capacité max</label>
                  <input type="number" min={1} value={form.capacite_max} onChange={(e) => setForm((f) => ({ ...f, capacite_max: e.target.value }))}
                    placeholder="Illimitée"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Quartier *</label>
                <select required value={form.id_quartier} onChange={(e) => setForm((f) => ({ ...f, id_quartier: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Sélectionner...</option>
                  {quartiers.map((q) => <option key={q.id_quartier} value={q.id_quartier}>{q.nom}</option>)}
                </select>
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
