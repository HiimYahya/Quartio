import { useEffect, useState } from 'react'
import { Users, Pencil, Coins, Ban, Download } from 'lucide-react'
import api from '../services/api'

const isSuspended = (u) => u.suspendu_jusqu_au && new Date(u.suspendu_jusqu_au) > new Date()

const ROLE_COLORS = {
  admin:      'bg-red-100 text-red-700',
  moderateur: 'bg-yellow-100 text-yellow-700',
  user:       'bg-blue-100 text-blue-700',
}

const EMPTY_FORM = { nom: '', prenom: '', email: '', mot_de_passe: '', role: 'user', langue: 'fr' }

export default function UtilisateursPage() {
  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [confirm,    setConfirm]    = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm,   setEditForm]   = useState({ nom: '', prenom: '', telephone: '', langue: 'fr' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError,  setEditError]  = useState(null)
  const [pointsTarget, setPointsTarget] = useState(null)
  const [pointsForm,   setPointsForm]   = useState({ montant: '', motif: '' })
  const [suspTarget,   setSuspTarget]   = useState(null)
  const [suspJours,    setSuspJours]    = useState(7)
  const [actionBusy,   setActionBusy]   = useState(false)

  const load = () => {
    api.get('/utilisateurs')
      .then(({ data }) => setUsers(data.data ?? data.utilisateurs ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    try {
      await api.delete(`/utilisateurs/${id}`)
      setUsers((u) => u.filter((x) => x.id_utilisateur !== id))
    } catch {}
    setConfirm(null)
  }

  const handleRoleChange = async (id, role) => {
    try {
      await api.put(`/utilisateurs/${id}`, { role })
      setUsers((u) => u.map((x) => x.id_utilisateur === id ? { ...x, role } : x))
    } catch {}
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const { data } = await api.post('/auth/register', {
        nom: form.nom, prenom: form.prenom, email: form.email,
        mot_de_passe: form.mot_de_passe, langue: form.langue,
      })
      const newUser = data.utilisateur
      if (form.role !== 'user' && newUser?.id_utilisateur) {
        await api.put(`/utilisateurs/${newUser.id_utilisateur}`, { role: form.role })
        newUser.role = form.role
      }
      setUsers((u) => [...u, { ...newUser, points_solde: 0 }])
      setShowCreate(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      setFormError(err.response?.data?.error ?? 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (u) => {
    setEditTarget(u)
    setEditForm({ nom: u.nom ?? '', prenom: u.prenom ?? '', telephone: u.telephone ?? '', langue: u.langue ?? 'fr' })
    setEditError(null)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setEditSaving(true)
    setEditError(null)
    try {
      const { data } = await api.put(`/utilisateurs/${editTarget.id_utilisateur}`, editForm)
      setUsers((u) => u.map((x) => x.id_utilisateur === editTarget.id_utilisateur ? { ...x, ...data } : x))
      setEditTarget(null)
    } catch (err) {
      setEditError(err.response?.data?.error ?? 'Erreur lors de la modification')
    } finally {
      setEditSaving(false)
    }
  }

  const handlePoints = async (e) => {
    e.preventDefault()
    setActionBusy(true)
    try {
      const { data } = await api.post(`/utilisateurs/${pointsTarget.id_utilisateur}/points`, {
        montant: parseInt(pointsForm.montant), motif: pointsForm.motif || undefined,
      })
      setUsers((u) => u.map((x) => x.id_utilisateur === pointsTarget.id_utilisateur ? { ...x, points_solde: data.points_solde } : x))
      setPointsTarget(null); setPointsForm({ montant: '', motif: '' })
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    } finally { setActionBusy(false) }
  }

  const handleSuspend = async (jours) => {
    setActionBusy(true)
    try {
      const { data } = await api.put(`/utilisateurs/${suspTarget.id_utilisateur}/suspension`, { jours })
      setUsers((u) => u.map((x) => x.id_utilisateur === suspTarget.id_utilisateur ? { ...x, suspendu_jusqu_au: data.suspendu_jusqu_au } : x))
      setSuspTarget(null)
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur')
    } finally { setActionBusy(false) }
  }

  const exportCSV = () => {
    const cols = ['id_utilisateur', 'nom', 'prenom', 'email', 'role', 'points_solde', 'email_verifie', 'date_inscription', 'suspendu_jusqu_au']
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = [cols.join(','), ...filtered.map((u) => cols.map((c) => escape(u[c])).join(','))]
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const filtered = users.filter((u) => {
    const matchSearch = !search || `${u.nom} ${u.prenom} ${u.email}`.toLowerCase().includes(search.toLowerCase())
    const matchRole   = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un utilisateur..."
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1 min-w-48" />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="all">Tous les rôles</option>
          <option value="user">Habitants</option>
          <option value="moderateur">Modérateurs</option>
          <option value="admin">Admins</option>
        </select>
        <span className="text-sm text-slate-400 self-center">{filtered.length} résultat(s)</span>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 border border-slate-300 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm font-medium transition">
          <Download className="w-4 h-4" /> Export CSV
        </button>
        <button onClick={() => { setShowCreate(true); setFormError(null); setForm(EMPTY_FORM) }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          + Nouvel utilisateur
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">Aucun utilisateur trouvé.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Nom', 'Email', 'Rôle', 'Points', 'Inscription', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((u) => (
                <tr key={u.id_utilisateur} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-semibold text-xs shrink-0">
                        {u.prenom?.[0]}{u.nom?.[0]}
                      </div>
                      <span className="font-medium text-slate-800">{u.prenom} {u.nom}</span>
                      {isSuspended(u) && (
                        <span className="text-[10px] font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Suspendu</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <select value={u.role}
                      onChange={(e) => handleRoleChange(u.id_utilisateur, e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${ROLE_COLORS[u.role] ?? 'bg-slate-100 text-slate-600'}`}>
                      <option value="user">Habitant</option>
                      <option value="moderateur">Modérateur</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.points_solde ?? 0} pts</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {u.date_inscription ? new Date(u.date_inscription).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <button onClick={() => openEdit(u)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline">
                        <Pencil className="w-3.5 h-3.5" /> Modifier
                      </button>
                      <button onClick={() => { setPointsTarget(u); setPointsForm({ montant: '', motif: '' }) }}
                        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 hover:underline">
                        <Coins className="w-3.5 h-3.5" /> Points
                      </button>
                      <button onClick={() => { setSuspTarget(u); setSuspJours(7) }}
                        className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 hover:underline">
                        <Ban className="w-3.5 h-3.5" /> {isSuspended(u) ? 'Réactiver' : 'Suspendre'}
                      </button>
                      <button onClick={() => setConfirm(u)}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline">
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="font-semibold text-slate-800 mb-4">Modifier {editTarget.prenom} {editTarget.nom}</h3>
            {editError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{editError}</p>}
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Prénom *</label>
                  <input required value={editForm.prenom} onChange={(e) => setEditForm((f) => ({ ...f, prenom: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nom *</label>
                  <input required value={editForm.nom} onChange={(e) => setEditForm((f) => ({ ...f, nom: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Téléphone</label>
                <input value={editForm.telephone} onChange={(e) => setEditForm((f) => ({ ...f, telephone: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Langue</label>
                <select value={editForm.langue} onChange={(e) => setEditForm((f) => ({ ...f, langue: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
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
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="font-semibold text-slate-800 mb-4">Nouvel utilisateur</h3>
            {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{formError}</p>}
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Prénom *</label>
                  <input required value={form.prenom} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nom *</label>
                  <input required value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
                <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mot de passe *</label>
                <input required type="password" minLength={8} value={form.mot_de_passe} onChange={(e) => setForm((f) => ({ ...f, mot_de_passe: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Rôle</label>
                  <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="user">Habitant</option>
                    <option value="moderateur">Modérateur</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Langue</label>
                  <select value={form.langue} onChange={(e) => setForm((f) => ({ ...f, langue: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="fr">Français</option>
                    <option value="en">English</option>
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

      {pointsTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-slate-800 mb-1">Créditer / débiter des points</h3>
            <p className="text-sm text-slate-500 mb-4">{pointsTarget.prenom} {pointsTarget.nom} — solde actuel : <strong>{pointsTarget.points_solde ?? 0} pts</strong></p>
            <form onSubmit={handlePoints} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Montant (négatif = débit) *</label>
                <input required type="number" value={pointsForm.montant}
                  onChange={(e) => setPointsForm((f) => ({ ...f, montant: e.target.value }))}
                  placeholder="Ex: 50 ou -20"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Motif</label>
                <input value={pointsForm.motif} onChange={(e) => setPointsForm((f) => ({ ...f, motif: e.target.value }))}
                  placeholder="Ex: Récompense bénévolat"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setPointsTarget(null)}
                  className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50 transition">Annuler</button>
                <button type="submit" disabled={actionBusy}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg text-sm transition disabled:opacity-60">
                  {actionBusy ? '...' : 'Appliquer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {suspTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-slate-800 mb-1">{isSuspended(suspTarget) ? 'Réactiver' : 'Suspendre'} le compte</h3>
            <p className="text-sm text-slate-500 mb-4">{suspTarget.prenom} {suspTarget.nom}</p>
            {isSuspended(suspTarget) ? (
              <p className="text-sm text-slate-600 mb-4">
                Suspendu jusqu'au <strong>{new Date(suspTarget.suspendu_jusqu_au).toLocaleDateString('fr-FR')}</strong>. Réactiver le compte immédiatement ?
              </p>
            ) : (
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-600 mb-1">Durée (jours)</label>
                <input type="number" min={1} value={suspJours} onChange={(e) => setSuspJours(parseInt(e.target.value) || 1)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-xs text-slate-400 mt-1">L'utilisateur ne pourra pas se connecter et ses sessions seront révoquées.</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setSuspTarget(null)}
                className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50 transition">Annuler</button>
              {isSuspended(suspTarget) ? (
                <button onClick={() => handleSuspend(0)} disabled={actionBusy}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm transition disabled:opacity-60">
                  {actionBusy ? '...' : 'Réactiver'}
                </button>
              ) : (
                <button onClick={() => handleSuspend(suspJours)} disabled={actionBusy}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg text-sm transition disabled:opacity-60">
                  {actionBusy ? '...' : 'Suspendre'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-slate-800 mb-2">Confirmer la suppression</h3>
            <p className="text-sm text-slate-500 mb-5">
              Supprimer <strong>{confirm.prenom} {confirm.nom}</strong> ? Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)}
                className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50 transition">
                Annuler
              </button>
              <button onClick={() => handleDelete(confirm.id_utilisateur)}
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
