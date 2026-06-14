import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import api from '../services/api'

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
                    <button onClick={() => setConfirm(u)}
                      className="text-xs text-red-500 hover:text-red-700 hover:underline">
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal création */}
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

      {/* Modal confirmation suppression */}
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
