import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CalendarDays, MapPin, Users, ArrowLeft } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../store/authStore'

export default function EvenementDetailPage() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const user         = useAuthStore((s) => s.user)
  const [ev, setEv]           = useState(null)
  const [loading, setLoading] = useState(true)
  const [inscrit, setInscrit] = useState(false)
  const [nbParticipants, setNbParticipants] = useState(null)
  const [actionLoading, setActionLoading]   = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    Promise.all([
      api.get(`/evenements/${id}`),
      api.get(`/evenements/${id}/participants`),
    ])
      .then(([evRes, partRes]) => {
        setEv(evRes.data)
        const parts = partRes.data ?? []
        setNbParticipants(parts.length)
        setInscrit(parts.some((p) => p.id_utilisateur === (user?.id ?? user?.id_utilisateur)))
      })
      .catch(() => navigate('/evenements'))
      .finally(() => setLoading(false))
  }, [id])

  const handleToggle = async () => {
    setActionLoading(true); setError(null)
    try {
      if (inscrit) {
        await api.delete(`/evenements/${id}/participer`)
        setInscrit(false)
        setNbParticipants((n) => Math.max(0, (n ?? 1) - 1))
      } else {
        await api.post(`/evenements/${id}/participer`)
        setInscrit(true)
        setNbParticipants((n) => (n ?? 0) + 1)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur')
    }
    setActionLoading(false)
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement...</div>
  if (!ev) return null

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-'

  const isOrganisateur = ev.id_utilisateur_pg === (user?.id ?? user?.id_utilisateur)
  const complet = ev.capacite_max && nbParticipants >= ev.capacite_max && !inscrit

  return (
    <div className="max-w-2xl space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm text-[#2d7a5f] hover:underline inline-flex items-center gap-1.5">
        <ArrowLeft className="w-4 h-4" /> Retour aux événements
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header coloré */}
        <div className="bg-gradient-to-br from-[#1a4a3a] to-[#2d7a5f] px-6 py-8 text-white">
          <h2 className="text-2xl font-bold">{ev.titre}</h2>
          {ev.statut && ev.statut !== 'planifie' && (
            <span className="mt-2 inline-block text-xs font-medium bg-white/20 px-2.5 py-1 rounded-full capitalize">
              {ev.statut.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Méta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span>{formatDate(ev.date_debut)}</span>
            </div>
            {ev.date_fin && (
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 shrink-0" />
                <span>{formatDate(ev.date_fin)}</span>
              </div>
            )}
            {ev.lieu && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>{ev.lieu}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 shrink-0" />
              <span>
                {nbParticipants ?? '...'} participant{nbParticipants !== 1 ? 's' : ''}
                {ev.capacite_max ? ` / ${ev.capacite_max} places` : ''}
              </span>
            </div>
          </div>

          {/* Barre de capacité */}
          {ev.capacite_max && nbParticipants !== null && (
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{nbParticipants} inscrits</span>
                <span>{ev.capacite_max - nbParticipants} places restantes</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${nbParticipants >= ev.capacite_max ? 'bg-red-400' : 'bg-[#34d399]'}`}
                  style={{ width: `${Math.min(100, (nbParticipants / ev.capacite_max) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {ev.description && (
            <p className="text-gray-600 text-sm leading-relaxed">{ev.description}</p>
          )}

          <div className="border-t border-gray-100 pt-4 text-sm text-gray-500">
            Organisé par <span className="font-medium text-gray-700">{ev.prenom ?? 'Un voisin'}</span>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          {/* Bouton d'action */}
          {!isOrganisateur && (
            <button
              onClick={handleToggle}
              disabled={actionLoading || complet}
              className={`w-full font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 ${
                inscrit
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                  : complet
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-[#1a4a3a] hover:bg-[#0f2e24] text-white'
              }`}
            >
              {actionLoading ? '...' : inscrit ? 'Inscrit - Se désinscrire' : complet ? 'Complet' : "S'inscrire à cet événement"}
            </button>
          )}

          {isOrganisateur && (
            <div className="bg-[#f0faf5] rounded-xl px-4 py-3 text-sm text-[#1a4a3a] font-medium">
              Vous organisez cet événement.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
