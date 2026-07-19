import { useEffect, useState } from 'react'
import { Megaphone, Pencil } from 'lucide-react'
import api from '../services/api'

const STATUT_COLORS = {
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-slate-100 text-slate-500',
  archivee: 'bg-purple-100 text-purple-600',
}

const EMPTY_FORM = { titre: '', description: '', type: 'offre', est_payant: false, cout_points: 0, categorie: '', id_quartier: '' }

export default function AnnoncesPage() {
  const [items,      setItems]      = useState([])
  const [quartiers,  setQuartiers]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState('all')
  const [confirm,    setConfirm]    = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm,   setEditForm]   = useState(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)
  const [editError,  setEditError]  = useState(null)

  const load = () => {
    api.get('/annonces')
      .then(({ data }) => setItems(data.data ?? data.annonces ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    api.get('/quartiers').then(({ data }) => setQuartiers(data.data ?? data.quartiers ?? [])).catch(() => {})
  }, [])

  const handleStatut = async (id, statut) => {
    try {
      await api.put(`/annonces/${id}`, { statut })
      setItems((v) => v.map((x) => (x.id ?? x._id) === id ? { ...x, statut } : x))
    } catch {}
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/annonces/${id}`)
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
        titre:       form.titre,
        description: form.description || null,
        type:        form.type || null,
        est_payant:  form.est_payant,
        cout_points: form.est_payant ? Number(form.cout_points) : 0,
        categorie:   form.categorie || null,
        id_quartier: Number(form.id_quartier),
      }
      const { data } = await api.post('/annonces', payload)
      setItems((v) => [data.data ?? data.annonce ?? data, ...v])
      setShowCreate(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      setFormError(err.response?.data?.error ?? 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (a) => {
    const id = a.id ?? a._id
    setEditTarget({ id, titre: a.titre })
    setEditForm({
      titre:       a.titre ?? '',
      description: a.description ?? '',
      type:        a.type ?? 'offre',
      est_payant:  !!a.est_payant,
      cout_points: a.cout_points ?? 0,
      categorie:   a.categorie ?? '',
      id_quartier: a.id_quartier ?? '',
    })
    setEditError(null)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setEditSaving(true)
    setEditError(null)
    try {
      const payload = {
        titre:       editForm.titre,
        description: editForm.description || null,
        type:        editForm.type || null,
        est_payant:  editForm.est_payant,
        cout_points: editForm.est_payant ? Number(editForm.cout_points) : 0,
        categorie:   editForm.categorie || null,
      }
      await api.put(`/annonces/${editTarget.id}`, payload)
      setItems((v) => v.map((x) => (x.id ?? x._id) === editTarget.id ? { ...x, ...payload } : x))
      setEditTarget(null)
    } catch (err) {
      setEditError(err.response?.data?.error ?? 'Erreur lors de la modification')
    } finally {
      setEditSaving(false)
    }
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
        <span className="text-sm text-slate-400">{filtered.length} annonce(s)</span>
        <button onClick={() => { setShowCreate(true); setFormError(null); setForm(EMPTY_FORM) }}
          className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition">
          + Nouvelle annonce
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
          <Megaphone className="w-8 h-8 text-slate-300 mx-auto mb-3" />
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
                        {a.type ?? '-'}
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
                    <td className="px-4 py-3 flex items-center gap-3">
                      <button onClick={() => openEdit(a)} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline">
                        <Pencil className="w-3.5 h-3.5" />
                        Modifier
                      </button>
                      <button onClick={() => handleStatut(id, 'archivee')} className="text-xs text-slate-400 hover:text-slate-600 hover:underline">
                        Archiver
                      </button>
                      <button onClick={() => setConfirm({ id, titre: a.titre })} className="text-xs text-red-500 hover:underline">
                        Supprimer
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-800 mb-4">Modifier l'annonce</h3>
            {editError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{editError}</p>}
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
                <input required value={editForm.titre} onChange={(e) => setEditForm((f) => ({ ...f, titre: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea rows={3} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                  <select value={editForm.type} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="offre">Offre</option>
                    <option value="demande">Demande</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Catégorie</label>
                  <input value={editForm.categorie} onChange={(e) => setEditForm((f) => ({ ...f, categorie: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={editForm.est_payant} onChange={(e) => setEditForm((f) => ({ ...f, est_payant: e.target.checked }))}
                    className="rounded" />
                  Payant
                </label>
                {editForm.est_payant && (
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} value={editForm.cout_points} onChange={(e) => setEditForm((f) => ({ ...f, cout_points: e.target.value }))}
                      className="w-24 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <span className="text-xs text-slate-500">pts</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditTarget(null)}
                  className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50 transition">
                  Annuler
                </button>
                <button type="submit" disabled={editSaving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm transition disabled:opacity-60">
                  {editSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-800 mb-4">Nouvelle annonce</h3>
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
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="offre">Offre</option>
                    <option value="demande">Demande</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Catégorie</label>
                  <input value={form.categorie} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}
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
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={form.est_payant} onChange={(e) => setForm((f) => ({ ...f, est_payant: e.target.checked }))}
                    className="rounded" />
                  Payant
                </label>
                {form.est_payant && (
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} value={form.cout_points} onChange={(e) => setForm((f) => ({ ...f, cout_points: e.target.value }))}
                      className="w-24 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <span className="text-xs text-slate-500">pts</span>
                  </div>
                )}
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
