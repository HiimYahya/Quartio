import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Vote } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../store/authStore'
import { getSocket } from '../services/socket'

const TYPE_LABELS = {
  choix_multiple: 'Choix multiple',
  oui_non:        'Oui / Non',
  classement:     'Classement',
}

export default function VotesPage() {
  const [votes, setVotes]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({
    titre: '', description: '', type_vote: 'choix_multiple', options: ['', ''],
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState(null)
  const [voted, setVoted]           = useState({})
  const [rankings, setRankings]     = useState({}) // voteId -> [optId, ...]
  const user = useAuthStore((s) => s.user)
  const [myQuartiers, setMyQuartiers] = useState([])

  useEffect(() => {
    if (!user?.id) return
    api.get(`/utilisateurs/${user.id}/quartiers`)
      .then(({ data }) => setMyQuartiers(data ?? []))
      .catch(() => setMyQuartiers([]))
  }, [user?.id])

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/votes')
      setVotes(data.data ?? data.votes ?? data ?? [])
    } catch { setVotes([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Résultats en temps réel : un vote déposé ailleurs rafraîchit la liste
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const onUpdate = () => load()
    socket.on('vote:update', onUpdate)
    return () => socket.off('vote:update', onUpdate)
  }, [])

  // ── Vote classique (choix_multiple / oui_non) ────────────────────────────
  const handleVote = async (voteId, idOption) => {
    try {
      await api.post(`/votes/${voteId}/voter`, { id_option: idOption })
      setVoted((v) => ({ ...v, [voteId]: idOption }))
      load()
    } catch {}
  }

  // ── Vote classement : soumettre l'ordre ──────────────────────────────────
  const handleRankingSubmit = async (voteId) => {
    const ordre = rankings[voteId]
    if (!ordre || ordre.length === 0) return
    try {
      await api.post(`/votes/${voteId}/voter`, { classement: ordre })
      setVoted((v) => ({ ...v, [voteId]: 'done' }))
      load()
    } catch {}
  }

  const moveRankingItem = (voteId, options, idx, dir) => {
    const current = rankings[voteId] ?? options.map((o) => o.id_option ?? o.id_option)
    const arr = [...current]
    const target = idx + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
    setRankings((r) => ({ ...r, [voteId]: arr }))
  }

  const initRanking = (voteId, options) => {
    if (!rankings[voteId]) {
      setRankings((r) => ({ ...r, [voteId]: options.map((o) => o.id_option) }))
    }
  }

  // ── Création ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload = {
        titre:      form.titre,
        description: form.description || undefined,
        type_vote:  form.type_vote,
      }
      if (form.type_vote !== 'oui_non') {
        payload.options = form.options
          .filter(Boolean)
          .map((libelle, ordre) => ({ libelle, ordre }))
        if (payload.options.length < 2) {
          setError('Ajoutez au moins 2 options')
          setSubmitting(false)
          return
        }
      }
      await api.post('/votes', payload)
      setShowForm(false)
      setForm({ titre: '', description: '', type_vote: 'choix_multiple', options: ['', ''] })
      load()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Erreur lors de la création')
    }
    setSubmitting(false)
  }

  const addOption    = () => setForm((f) => ({ ...f, options: [...f.options, ''] }))
  const updateOption = (i, val) =>
    setForm((f) => ({ ...f, options: f.options.map((o, idx) => idx === i ? val : o) }))
  const removeOption = (i) =>
    setForm((f) => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{votes.length} vote(s)</p>
        <button onClick={() => setShowForm((v) => !v)}
          className="bg-[#1a4a3a] hover:bg-[#0f2e24] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          {showForm ? 'Annuler' : '+ Créer un vote'}
        </button>
      </div>

      {/* ── Formulaire de création ─────────────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">Nouveau vote</h3>
          {myQuartiers.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Rejoignez d'abord un quartier dans votre <Link to="/profil" className="underline font-medium">profil</Link> pour créer un vote.
            </p>
          ) : (
            <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              Vote proposé dans votre quartier : <span className="font-medium">{myQuartiers[0].nom}</span>
            </p>
          )}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
              required placeholder="Ex: Faut-il installer de nouveaux bancs ?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Contexte du vote (optionnel)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type de vote *</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(TYPE_LABELS).map(([type, label]) => (
                <button key={type} type="button"
                  onClick={() => setForm((f) => ({ ...f, type_vote: type }))}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                    form.type_vote === type
                      ? 'bg-[#1a4a3a] text-white border-[#1a4a3a]'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-[#34d399]'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            {form.type_vote === 'oui_non' && (
              <p className="text-xs text-gray-400 mt-1.5">Les options "Oui" et "Non" sont générées automatiquement.</p>
            )}
            {form.type_vote === 'classement' && (
              <p className="text-xs text-gray-400 mt-1.5">Les participants ordonnent les options par préférence.</p>
            )}
          </div>

          {form.type_vote !== 'oui_non' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Options * (min. 2)</label>
              <div className="space-y-2">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={opt} onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]" />
                    {form.options.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)}
                        className="text-red-400 hover:text-red-600 text-lg px-1">×</button>
                    )}
                  </div>
                ))}
              </div>
              {form.options.length < 6 && (
                <button type="button" onClick={addOption} className="mt-2 text-sm text-[#2d7a5f] hover:underline">
                  + Ajouter une option
                </button>
              )}
            </div>
          )}

          <button type="submit" disabled={submitting || myQuartiers.length === 0}
            className="bg-[#1a4a3a] hover:bg-[#0f2e24] text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-60">
            {submitting ? 'Création...' : 'Créer le vote'}
          </button>
        </form>
      )}

      {/* ── Liste des votes ────────────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : votes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Vote className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucun vote en cours.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {votes.map((v) => {
            const total    = v.options?.reduce((sum, o) => sum + (o.nb_votes ?? 0), 0) ?? 0
            const voteId   = v.id_vote ?? v.id
            const hasVoted = voted[voteId] ?? v.mon_vote
            const closed   = v.statut && v.statut !== 'ouvert'
            const showResults = !!hasVoted || closed
            const typeVote = v.type_vote || 'choix_multiple'

            if (typeVote === 'classement') {
              const opts = v.options ?? []
              if (!rankings[voteId] && opts.length > 0) initRanking(voteId, opts)
              const order = rankings[voteId] ?? opts.map((o) => o.id_option)
              const sortedOpts = order.map((id) => opts.find((o) => o.id_option === id)).filter(Boolean)

              return (
                <div key={voteId} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-800">{v.titre}</h4>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Classement</span>
                  </div>
                  {v.description && <p className="text-sm text-gray-500 mb-3">{v.description}</p>}

                  {hasVoted ? (
                    <div className="text-sm text-green-600 font-medium py-2">Votre classement a été enregistré.</div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-400 mb-2">Ordonnez les options par préférence (1 = meilleur)</p>
                      <div className="space-y-2">
                        {sortedOpts.map((opt, idx) => (
                          <div key={opt.id_option}
                            className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-200">
                            <span className="w-6 h-6 bg-[#1a4a3a] text-white text-xs font-bold rounded-full flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="flex-1 text-sm text-gray-700">{opt.libelle}</span>
                            <div className="flex gap-1">
                              <button onClick={() => moveRankingItem(voteId, opts, idx, -1)} disabled={idx === 0}
                                className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-lg leading-none">^</button>
                              <button onClick={() => moveRankingItem(voteId, opts, idx, 1)} disabled={idx === sortedOpts.length - 1}
                                className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-lg leading-none">v</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => handleRankingSubmit(voteId)}
                        className="mt-3 bg-[#1a4a3a] hover:bg-[#0f2e24] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                        Valider mon classement
                      </button>
                    </>
                  )}
                  <p className="text-xs text-gray-400 mt-3">{total} participant(s)</p>
                </div>
              )
            }

            // choix_multiple et oui_non
            return (
              <div key={voteId} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-800">{v.titre}</h4>
                  {typeVote === 'oui_non' && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Oui / Non</span>
                  )}
                  {closed && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Fermé</span>}
                </div>
                {v.description && <p className="text-sm text-gray-500 mb-3">{v.description}</p>}
                <div className="space-y-2 mt-3">
                  {(v.options ?? []).map((opt) => {
                    const optId    = opt.id_option ?? opt.id
                    const pct      = total > 0 ? Math.round((opt.nb_votes ?? 0) / total * 100) : 0
                    const isSelected = hasVoted === optId
                    const canVote  = !hasVoted && !closed
                    return (
                      <button key={optId}
                        onClick={() => canVote && handleVote(voteId, optId)}
                        disabled={!canVote}
                        className={`w-full text-left rounded-lg border transition-all overflow-hidden ${
                          isSelected
                            ? 'border-[#34d399] bg-[#34d399]/10'
                            : showResults
                              ? 'border-gray-200 bg-gray-50 cursor-default'
                              : 'border-gray-200 hover:border-[#2d7a5f] hover:bg-[#f0faf5]'
                        }`}>
                        <div className="relative px-4 py-2.5">
                          {showResults && (
                            <div className={`absolute inset-0 ${isSelected ? 'bg-[#34d399]/20' : 'bg-[#1a4a3a]/5'}`}
                              style={{ width: `${pct}%` }} />
                          )}
                          <div className="relative flex justify-between items-center text-sm">
                            <span className="font-medium text-gray-700">{opt.libelle}{isSelected && ' ✓'}</span>
                            {showResults && <span className="text-gray-500 text-xs font-medium">{pct}% · {opt.nb_votes ?? 0}</span>}
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
