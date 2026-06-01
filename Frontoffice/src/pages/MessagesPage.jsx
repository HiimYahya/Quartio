import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import useAuthStore from '../store/authStore'
import useSocketStore from '../store/socketStore'
import OnlineBadge from '../components/ui/OnlineBadge'
import { getSocket } from '../services/socket'

export default function MessagesPage() {
  const [conversations, setConversations] = useState([])
  const [loading,       setLoading]       = useState(true)
  const user     = useAuthStore((s) => s.user)
  const isOnline = useSocketStore((s) => s.isOnline)

  const load = () => {
    api.get('/conversations')
      .then(({ data }) => setConversations(data.conversations ?? data.data ?? data ?? []))
      .catch(() => setConversations([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()

    // Nouveau message → re-fetch la liste pour mettre à jour le dernier message
    const socket = getSocket()
    if (socket) {
      socket.on('message:new', () => load())
    }

    return () => {
      getSocket()?.off('message:new')
    }
  }, [])

  const getOtherParticipant = (conv) => {
    if (!conv.participants) return null
    return conv.participants.find(
      (p) => (p.id ?? p.id_utilisateur) !== (user?.id ?? user?.id_utilisateur)
    )
  }

  const getOtherName = (conv) => {
    const other = getOtherParticipant(conv)
    return other ? `${other.prenom} ${other.nom}` : 'Voisin'
  }

  const getOtherId = (conv) => {
    const other = getOtherParticipant(conv)
    return other?.id ?? other?.id_utilisateur ?? null
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{conversations.length} conversation(s)</p>
        <SocketStatus />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement…</div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <p className="text-4xl mb-3">💬</p>
          <p className="text-gray-500">Aucune conversation.</p>
          <p className="text-sm text-gray-400 mt-1">Contactez un voisin depuis une annonce.</p>
        </div>
      ) : (
        conversations.map((conv) => {
          const otherId   = getOtherId(conv)
          const otherName = getOtherName(conv)
          const online    = otherId ? isOnline(otherId) : false

          return (
            <Link
              key={conv.id ?? conv._id}
              to={`/messages/${conv.id ?? conv._id}`}
              className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
            >
              {/* Avatar + badge online */}
              <div className="relative shrink-0">
                <div className="w-10 h-10 bg-[#1a4a3a] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {otherName[0]?.toUpperCase() ?? '?'}
                </div>
                {otherId && <OnlineBadge userId={otherId} />}
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-800 truncate">{otherName}</p>
                  {online && (
                    <span className="text-xs text-green-600 font-medium shrink-0">● En ligne</span>
                  )}
                </div>
                <p className="text-sm text-gray-400 truncate">
                  {conv.dernier_message ?? 'Aucun message'}
                </p>
              </div>

              {/* Date */}
              {conv.date_dernier_message && (
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(conv.date_dernier_message).toLocaleDateString('fr-FR')}
                </span>
              )}
            </Link>
          )
        })
      )}
    </div>
  )
}

// Indicateur de connexion Socket.io
function SocketStatus() {
  const connected = useSocketStore((s) => s.connected)

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400">
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-300'}`} />
      {connected ? 'Temps réel actif' : 'Temps réel indisponible'}
    </div>
  )
}
