import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function EvenementDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ev, setEv] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/evenements/${id}`)
      .then(({ data }) => setEv(data))
      .catch(() => navigate('/evenements'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement…</div>
  if (!ev) return null

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className="max-w-2xl space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm text-[#2d7a5f] hover:underline">
        ← Retour aux événements
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="text-xl font-bold text-gray-800">{ev.titre}</h2>

        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span>📅</span>
            <span>{formatDate(ev.date_debut)}</span>
          </div>
          {ev.lieu && (
            <div className="flex items-center gap-2">
              <span>📍</span>
              <span>{ev.lieu}</span>
            </div>
          )}
        </div>

        {ev.description && (
          <p className="text-gray-600 text-sm leading-relaxed">{ev.description}</p>
        )}

        <div className="border-t border-gray-100 pt-4 text-sm text-gray-500">
          Organisé par <span className="font-medium text-gray-700">{ev.prenom ?? ev.organisateur ?? 'Un voisin'}</span>
        </div>
      </div>
    </div>
  )
}
