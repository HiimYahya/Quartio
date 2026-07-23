import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone, Search } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../store/authStore'
import { toast } from '../store/toastStore'
import { CATEGORIE_REGEX, CATEGORIE_AIDE, TEXTE_REGEX, TEXTE_AIDE } from '../utils/formats'

const TYPE_LABELS = { offre: 'Offre', demande: 'Demande' }
const TYPE_COLORS = { offre: 'bg-green-100 text-green-700', demande: 'bg-blue-100 text-blue-700' }

export default function AnnoncesPage() {
  const [annonces, setAnnonces] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    titre: '', description: '', type: 'offre',
    est_payant: false, cout_points: 0, categorie: '', id_quartier: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const user = useAuthStore((s) => s.user)
  const [quartiers, setQuartiers] = useState([])

  useEffect(() => {
    if (!user?.id) return
    api.get(`/utilisateurs/${user.id}/quartiers`)
      .then(({ data }) => {
        const qs = data ?? []
        setQuartiers(qs)
        if (qs.length === 1) setForm((f) => ({ ...f, id_quartier: String(qs[0].id_quartier) }))
      })
      .catch(() => setQuartiers([]))
  }, [user?.id])

  const [filters, setFilters] = useState({ search: '', type: '', payant: '' })

  const load = async (f = filters) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (f.search)  params.set('search', f.search)
      if (f.type)    params.set('type', f.type)
      if (f.payant)  params.set('payant', f.payant)
      const { data } = await api.get('/annonces?' + params.toString())
      setAnnonces(data.data ?? data.annonces ?? data ?? [])
    } catch { setAnnonces([]) }
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(() => load(filters), 300)
    return () => clearTimeout(t)
  }, [filters])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!TEXTE_REGEX.test(form.titre)) {
      return setError(`Titre invalide : ${TEXTE_AIDE.toLowerCase()}`)
    }
    if (form.categorie && !CATEGORIE_REGEX.test(form.categorie)) {
      return setError(`Catégorie invalide : ${CATEGORIE_AIDE.toLowerCase()}`)
    }
    setSubmitting(true)
    try {
      const payload = {
        titre: form.titre,
        description: form.description,
        type: form.type,
        est_payant: form.est_payant,
        cout_points: form.est_payant ? parseInt(form.cout_points) : 0,
        categorie: form.categorie || undefined,
        id_quartier: parseInt(form.id_quartier),
      }
      await api.post('/annonces', payload)
      setShowForm(false)
      setForm({ titre: '', description: '', type: 'offre', est_payant: false, cout_points: 0, categorie: '', id_quartier: '' })
      load()
      toast.success('Annonce publiée')
    } catch (err) {
      setError(err.response?.data?.error ?? 'Erreur lors de la publication')
      toast.error(err.response?.data?.error ?? 'Erreur lors de la publication')
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{annonces.length} annonce(s) dans votre quartier</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-[#1a4a3a] hover:bg-[#0f2e24] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {showForm ? 'Annuler' : '+ Nouvelle annonce'}
        </button>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Rechercher une annonce..."
            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'type', value: '', label: 'Tout' },
            { key: 'type', value: 'offre', label: 'Offres' },
            { key: 'type', value: 'demande', label: 'Demandes' },
            { key: 'payant', value: 'false', label: 'Gratuit' },
            { key: 'payant', value: 'true', label: 'Payant' },
          ].map((chip) => {
            const isActive = filters[chip.key] === chip.value
            return (
              <button
                key={chip.key + chip.value}
                onClick={() => setFilters((f) => ({ ...f, [chip.key]: isActive ? '' : chip.value }))}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  isActive ? 'bg-[#1a4a3a] text-white border-[#1a4a3a]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#34d399]'
                }`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">Publier une annonce</h3>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input
              value={form.titre}
              onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
              required
              minLength={2}
              maxLength={200}
              placeholder="Ex: Cours de guitare, Garde de chat..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Décrivez votre service..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]"
              >
                <option value="offre">Offre</option>
                <option value="demande">Demande</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <input
                value={form.categorie}
                onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}
                placeholder="Ex: Bricolage, Jardinage..."
                maxLength={100}
                title={CATEGORIE_AIDE}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quartier</label>
            {quartiers.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Rejoignez d'abord un quartier dans votre <Link to="/profil" className="underline font-medium">profil</Link> pour publier une annonce.
              </p>
            ) : quartiers.length === 1 ? (
              <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                Publiée dans votre quartier : <span className="font-medium">{quartiers[0].nom}</span>
              </p>
            ) : (
              <select
                value={form.id_quartier}
                onChange={(e) => setForm((f) => ({ ...f, id_quartier: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]"
              >
                <option value="">Sélectionner un quartier</option>
                {quartiers.map((q) => (
                  <option key={q.id_quartier} value={q.id_quartier}>{q.nom}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="est_payant"
              checked={form.est_payant}
              onChange={(e) => setForm((f) => ({ ...f, est_payant: e.target.checked }))}
              className="w-4 h-4 accent-[#1a4a3a]"
            />
            <label htmlFor="est_payant" className="text-sm text-gray-700">Service payant (en points)</label>
          </div>

          {form.est_payant && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Coût en points</label>
              <input
                type="number"
                min={1}
                value={form.cout_points}
                onChange={(e) => setForm((f) => ({ ...f, cout_points: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || quartiers.length === 0}
            className="bg-[#1a4a3a] hover:bg-[#0f2e24] text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {submitting ? 'Publication...' : 'Publier'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : annonces.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Megaphone className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucune annonce pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {annonces.map((a) => (
            <Link
              key={a._id ?? a.id}
              to={`/annonces/${a._id ?? a.id}`}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-semibold text-gray-800 line-clamp-1">{a.titre}</h4>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[a.type] ?? 'bg-gray-100 text-gray-600'}`}>
                  {TYPE_LABELS[a.type] ?? a.type}
                </span>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2 mb-3">{a.description}</p>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{a.categorie ?? ''}</span>
                {a.est_payant
                  ? <span className="font-medium text-[#2d7a5f]">{a.cout_points} pts</span>
                  : <span className="text-green-600 font-medium">Gratuit</span>
                }
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
