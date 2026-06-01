import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function AnnonceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [annonce, setAnnonce] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/annonces/${id}`)
      .then(({ data }) => setAnnonce(data))
      .catch(() => navigate('/annonces'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement…</div>
  if (!annonce) return null

  return (
    <div className="max-w-2xl space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm text-[#2d7a5f] hover:underline">
        ← Retour aux annonces
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">{annonce.titre}</h2>
          <span className="bg-[#1a4a3a]/10 text-[#1a4a3a] text-xs font-medium px-2 py-1 rounded-full capitalize shrink-0">
            {annonce.type}
          </span>
        </div>

        <p className="text-gray-600 text-sm leading-relaxed mb-5">{annonce.description}</p>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-sm">
          <div className="text-gray-500">
            Publié par <span className="font-medium text-gray-700">{annonce.prenom ?? annonce.auteur ?? 'Voisin'}</span>
          </div>
          <div>
            {annonce.prix_points > 0
              ? <span className="font-semibold text-[#2d7a5f]">{annonce.prix_points} points</span>
              : <span className="text-green-600 font-semibold">Gratuit</span>
            }
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate('/messages')}
        className="w-full bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-3 rounded-xl transition-colors"
      >
        Contacter le voisin
      </button>
    </div>
  )
}
