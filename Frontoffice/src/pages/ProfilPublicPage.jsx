import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, HandHeart, Handshake, Megaphone, MessageSquare } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../store/authStore'

export default function ProfilPublicPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [profil, setProfil] = useState(null)
  const [loading, setLoading] = useState(true)
  const [contacting, setContacting] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get(`/utilisateurs/${id}/public`)
      .then(({ data }) => setProfil(data))
      .catch(() => setProfil(null))
      .finally(() => setLoading(false))
  }, [id])

  const isMe = user?.id === parseInt(id)

  const contacter = async () => {
    setContacting(true)
    try {
      const { data } = await api.post('/conversations', { participants: [parseInt(id)] })
      navigate(`/messages/${data._id}`)
    } catch { /* ignore */ } finally { setContacting(false) }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement...</div>
  if (!profil) return <div className="text-center py-12 text-gray-400">Profil introuvable.</div>

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm text-[#2d7a5f] hover:underline inline-flex items-center gap-1.5">
        <ArrowLeft className="w-4 h-4" /> Retour
      </button>

      {/* En-tête profil */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#1a4a3a] rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0">
            {profil.prenom?.[0]}{profil.nom?.[0]}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-800">{profil.prenom} {profil.nom}</h2>
            <p className="text-sm text-gray-500">
              Membre depuis {profil.date_inscription ? new Date(profil.date_inscription).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '-'}
            </p>
            {profil.role && profil.role !== 'user' && (
              <span className="mt-1 inline-block bg-[#1a4a3a]/10 text-[#1a4a3a] text-xs font-medium px-2 py-0.5 rounded-full capitalize">{profil.role}</span>
            )}
          </div>
        </div>

        {/* Stats d'entraide */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="bg-[#f0faf5] rounded-xl p-4 text-center">
            <HandHeart className="w-5 h-5 text-[#1a4a3a] mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-800">{profil.services_rendus ?? 0}</p>
            <p className="text-xs text-gray-500">service(s) rendu(s)</p>
          </div>
          <div className="bg-[#f0faf5] rounded-xl p-4 text-center">
            <Handshake className="w-5 h-5 text-[#1a4a3a] mx-auto mb-1" />
            <p className="text-xl font-bold text-gray-800">{profil.services_recus ?? 0}</p>
            <p className="text-xs text-gray-500">service(s) reçu(s)</p>
          </div>
        </div>

        {!isMe && (
          <button onClick={contacter} disabled={contacting}
            className="mt-4 w-full bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4" /> {contacting ? 'Ouverture...' : 'Contacter'}
          </button>
        )}
      </div>

      {/* Annonces actives */}
      <div>
        <h3 className="font-bold text-gray-800 mb-2">Ses annonces actives</h3>
        {(!profil.annonces || profil.annonces.length === 0) ? (
          <p className="text-sm text-gray-400 bg-white rounded-2xl border border-gray-100 p-4 text-center">Aucune annonce active visible.</p>
        ) : (
          <div className="space-y-2">
            {profil.annonces.map((a) => (
              <Link key={a._id} to={`/annonces/${a._id}`}
                className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-3 hover:shadow-sm transition-shadow">
                <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-800 text-sm truncate">{a.titre}</p>
                  <p className="text-xs text-gray-400 capitalize">{a.type}{a.categorie ? ` · ${a.categorie}` : ''}</p>
                </div>
                <span className="text-xs font-semibold text-gray-600 shrink-0">
                  {a.est_payant && a.cout_points > 0 ? `${a.cout_points} pts` : 'Gratuit'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
