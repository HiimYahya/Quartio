import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Coins, ArrowLeft } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../store/authStore'

const TYPE_LABELS = { offre: 'Offre de service', demande: 'Demande de service' }

export default function AnnonceDetailPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const [annonce,  setAnnonce]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState(false)
  const [contacting, setContacting] = useState(false)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    api.get(`/annonces/${id}`)
      .then(({ data }) => setAnnonce(data))
      .catch(() => navigate('/annonces'))
      .finally(() => setLoading(false))
  }, [id])

  const isAuteur  = user?.id === annonce?.id_utilisateur_pg
  const estPayant = annonce?.est_payant && (annonce?.cout_points ?? 0) > 0

  const handleAccepter = async () => {
    setCreating(true)
    setError(null)
    try {
      const { data } = await api.post(`/annonces/${id}/contrat`)
      navigate(`/contrats/${data.id_contrat}`)
    } catch (err) {
      // Contrat déjà existant -> redirection directe
      if (err.response?.data?.id_contrat) {
        navigate(`/contrats/${err.response.data.id_contrat}`)
        return
      }
      setError(err.response?.data?.error ?? 'Erreur lors de la création du contrat')
    } finally {
      setCreating(false)
    }
  }

  const handleContacter = async () => {
    if (!annonce?.id_utilisateur_pg) return
    setContacting(true)
    setError(null)
    try {
      const { data } = await api.post('/conversations', { participants: [annonce.id_utilisateur_pg] })
      navigate(`/messages/${data._id}`)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Impossible de démarrer la conversation')
    } finally {
      setContacting(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement...</div>
  if (!annonce) return null

  return (
    <div className="max-w-2xl space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm text-[#2d7a5f] hover:underline inline-flex items-center gap-1.5">
        <ArrowLeft className="w-4 h-4" /> Retour aux annonces
      </button>

      {/* Carte principale */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-800">{annonce.titre}</h2>
          <span className="bg-[#1a4a3a]/10 text-[#1a4a3a] text-xs font-medium px-2.5 py-1 rounded-full capitalize shrink-0">
            {TYPE_LABELS[annonce.type] ?? annonce.type}
          </span>
        </div>

        {annonce.categorie && (
          <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">
            {annonce.categorie}
          </span>
        )}

        <p className="text-gray-600 text-sm leading-relaxed">
          {annonce.description ?? 'Aucune description.'}
        </p>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="text-sm text-gray-500">
            Publié par{' '}
            <span className="font-medium text-gray-700">
              {annonce.prenom ?? 'Un voisin'}
            </span>
          </div>
          {estPayant ? (
            <div className="flex items-center gap-1.5 bg-[#1a4a3a]/10 text-[#1a4a3a] font-bold px-3 py-1.5 rounded-xl">
              <Coins className="w-4 h-4" />
              <span>{annonce.cout_points} points</span>
            </div>
          ) : (
            <span className="bg-green-100 text-green-700 font-semibold px-3 py-1.5 rounded-xl text-sm">
              Gratuit
            </span>
          )}
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      {isAuteur ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 text-center">
          C'est votre annonce. Vos voisins peuvent vous contacter pour l'accepter.
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={handleAccepter}
            disabled={creating || annonce.statut !== 'active'}
            className="w-full bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {creating ? (
              'Création du contrat...'
            ) : annonce.statut !== 'active' ? (
              'Annonce non disponible'
            ) : estPayant ? (
              <>Accepter ce service ({annonce.cout_points} pts)</>
            ) : (
              'Accepter ce service (gratuit)'
            )}
          </button>

          {estPayant && annonce.statut === 'active' && (
            <p className="text-xs text-gray-400 text-center">
              {annonce.cout_points} points seront débités à la finalisation, une fois les deux parties ayant signé.
            </p>
          )}

          <button
            onClick={handleContacter}
            disabled={contacting}
            className="w-full border border-[#1a4a3a] text-[#1a4a3a] hover:bg-[#1a4a3a]/5 font-medium py-2.5 rounded-xl transition-colors text-sm disabled:opacity-60"
          >
            {contacting ? 'Ouverture...' : 'Contacter le voisin'}
          </button>
        </div>
      )}
    </div>
  )
}
