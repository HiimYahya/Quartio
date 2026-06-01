import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import useQuartiers from '../hooks/useQuartiers'
import SwipeView from '../components/ui/SwipeView'

export default function EvenementsPage() {
  const [evenements, setEvenements] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('liste') // 'liste' | 'swipe'
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    titre: '', description: '', date_debut: '', date_fin: '',
    lieu: '', capacite_max: '', id_quartier: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const quartiers = useQuartiers()

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/evenements')
      setEvenements(data.data ?? data.evenements ?? data ?? [])
    } catch { setEvenements([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload = {
        titre: form.titre,
        description: form.description || undefined,
        date_debut: form.date_debut,
        date_fin: form.date_fin || undefined,
        lieu: form.lieu || undefined,
        capacite_max: form.capacite_max ? parseInt(form.capacite_max) : undefined,
        id_quartier: parseInt(form.id_quartier),
      }
      await api.post('/evenements', payload)
      setShowForm(false)
      setForm({ titre: '', description: '', date_debut: '', date_fin: '', lieu: '', capacite_max: '', id_quartier: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Erreur lors de la création')
    }
    setSubmitting(false)
  }

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{evenements.length} événement(s)</p>
        <div className="flex items-center gap-2">
          {/* Toggle liste / swipe */}
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setMode('liste')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'liste'
                  ? 'bg-white text-[#1a4a3a] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ☰ Liste
            </button>
            <button
              onClick={() => { setMode('swipe'); setShowForm(false) }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'swipe'
                  ? 'bg-white text-[#1a4a3a] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ♥ Swipe
            </button>
          </div>
          {mode === 'liste' && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="bg-[#1a4a3a] hover:bg-[#0f2e24] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {showForm ? 'Annuler' : '+ Créer'}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">Nouvel événement</h3>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input
              value={form.titre}
              onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
              required
              placeholder="Ex: Barbecue de quartier..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de début *</label>
              <input
                type="datetime-local"
                value={form.date_debut}
                onChange={(e) => setForm((f) => ({ ...f, date_debut: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
              <input
                type="datetime-local"
                value={form.date_fin}
                onChange={(e) => setForm((f) => ({ ...f, date_fin: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
              <input
                value={form.lieu}
                onChange={(e) => setForm((f) => ({ ...f, lieu: e.target.value }))}
                placeholder="Place du marché..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacité max</label>
              <input
                type="number"
                min={1}
                value={form.capacite_max}
                onChange={(e) => setForm((f) => ({ ...f, capacite_max: e.target.value }))}
                placeholder="Ex: 50"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quartier *</label>
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
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-[#1a4a3a] hover:bg-[#0f2e24] text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {submitting ? 'Création…' : 'Créer'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement…</div>
      ) : evenements.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-gray-500">Aucun événement pour le moment.</p>
        </div>
      ) : mode === 'swipe' ? (
        <SwipeView evenements={evenements} />
      ) : (
        <div className="space-y-3">
          {evenements.map((ev) => (
            <Link
              key={ev._id ?? ev.id}
              to={`/evenements/${ev._id ?? ev.id}`}
              className="flex items-center gap-4 bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
            >
              <div className="w-14 h-14 bg-[#1a4a3a]/10 rounded-xl flex flex-col items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-[#1a4a3a] uppercase">
                  {ev.date_debut ? new Date(ev.date_debut).toLocaleDateString('fr-FR', { month: 'short' }) : '?'}
                </span>
                <span className="text-xl font-bold text-[#1a4a3a]">
                  {ev.date_debut ? new Date(ev.date_debut).getDate() : '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-800 truncate">{ev.titre}</h4>
                <p className="text-sm text-gray-500 truncate">{ev.lieu ?? 'Lieu non précisé'}</p>
              </div>
              <div className="text-xs text-gray-400 shrink-0">
                {formatDate(ev.date_debut)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
