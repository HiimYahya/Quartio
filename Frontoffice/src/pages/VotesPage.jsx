import { useEffect, useState } from 'react'
import api from '../services/api'

export default function VotesPage() {
  const [votes, setVotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ titre: '', description: '', options: ['', ''] })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [voted, setVoted] = useState({})

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/votes')
      setVotes(data.data ?? data.votes ?? data ?? [])
    } catch { setVotes([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleVote = async (voteId, idOption) => {
    try {
      await api.post(`/votes/${voteId}/voter`, { id_option: idOption })
      setVoted((v) => ({ ...v, [voteId]: idOption }))
      load()
    } catch {}
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api.post('/votes', {
        titre: form.titre,
        description: form.description || undefined,
        options: form.options
          .filter(Boolean)
          .map((libelle, ordre) => ({ libelle, ordre })),
      })
      setShowForm(false)
      setForm({ titre: '', description: '', options: ['', ''] })
      load()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Erreur lors de la création')
    }
    setSubmitting(false)
  }

  const addOption = () => setForm((f) => ({ ...f, options: [...f.options, ''] }))
  const updateOption = (i, val) =>
    setForm((f) => ({ ...f, options: f.options.map((o, idx) => idx === i ? val : o) }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{votes.length} vote(s) actif(s)</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-[#1a4a3a] hover:bg-[#0f2e24] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {showForm ? 'Annuler' : '+ Créer un vote'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">Nouveau vote</h3>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input
              value={form.titre}
              onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
              required
              placeholder="Ex: Faut-il installer de nouveaux bancs ?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Contexte du vote (optionnel)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Options * (min. 2)</label>
            <div className="space-y-2">
              {form.options.map((opt, i) => (
                <input
                  key={i}
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  required
                  placeholder={`Option ${i + 1}`}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]"
                />
              ))}
            </div>
            {form.options.length < 5 && (
              <button type="button" onClick={addOption} className="mt-2 text-sm text-[#2d7a5f] hover:underline">
                + Ajouter une option
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-[#1a4a3a] hover:bg-[#0f2e24] text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {submitting ? 'Création…' : 'Créer le vote'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement…</div>
      ) : votes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <p className="text-4xl mb-3">🗳️</p>
          <p className="text-gray-500">Aucun vote en cours.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {votes.map((v) => {
            const total = v.options?.reduce((sum, o) => sum + (o.nb_votes ?? 0), 0) ?? 0
            const hasVoted = voted[v.id ?? v._id]
            const voteId = v.id ?? v._id
            return (
              <div key={voteId} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h4 className="font-semibold text-gray-800 mb-1">{v.titre}</h4>
                {v.description && <p className="text-sm text-gray-500 mb-3">{v.description}</p>}
                <div className="space-y-2 mt-3">
                  {(v.options ?? []).map((opt) => {
                    const optId = opt.id ?? opt._id ?? opt.id_option
                    const pct = total > 0 ? Math.round((opt.nb_votes ?? 0) / total * 100) : 0
                    const isSelected = hasVoted === optId
                    return (
                      <button
                        key={optId}
                        onClick={() => !hasVoted && handleVote(voteId, optId)}
                        disabled={!!hasVoted}
                        className={`w-full text-left rounded-lg border transition-all overflow-hidden ${
                          isSelected
                            ? 'border-[#34d399] bg-[#34d399]/10'
                            : hasVoted
                            ? 'border-gray-200 bg-gray-50 cursor-default'
                            : 'border-gray-200 hover:border-[#2d7a5f] hover:bg-[#f0faf5]'
                        }`}
                      >
                        <div className="relative px-4 py-2.5">
                          {hasVoted && (
                            <div
                              className="absolute inset-0 bg-[#1a4a3a]/5 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          )}
                          <div className="relative flex justify-between items-center text-sm">
                            <span className="font-medium text-gray-700">{opt.libelle}</span>
                            {hasVoted && <span className="text-gray-500 text-xs">{pct}%</span>}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-3">{total} vote(s) au total</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
