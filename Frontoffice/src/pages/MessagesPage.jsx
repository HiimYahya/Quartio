import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageCircle, Plus, Search, X } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../store/authStore'
import useSocketStore from '../store/socketStore'
import OnlineBadge from '../components/ui/OnlineBadge'
import { getSocket } from '../services/socket'

function relativeTime(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)  return "à l'instant"
  const m = Math.floor(s / 60)
  if (m < 60)  return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24)  return `il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7)   return `il y a ${d}j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState([])
  const [loading,       setLoading]       = useState(true)
  const user     = useAuthStore((s) => s.user)
  const isOnline = useSocketStore((s) => s.isOnline)
  const navigate = useNavigate()
  const [showNew,   setShowNew]   = useState(false)
  const [neighbors, setNeighbors] = useState([])
  const [nSearch,   setNSearch]   = useState('')
  const [nLoading,  setNLoading]  = useState(false)
  const [starting,  setStarting]  = useState(false)

  const openNew = async () => {
    setShowNew(true); setNSearch(''); setNLoading(true)
    try {
      const { data: quartiers } = await api.get(`/utilisateurs/${user.id}/quartiers`)
      const lists = await Promise.all((quartiers ?? []).map((q) =>
        api.get(`/quartiers/${q.id_quartier}/habitants`).then(({ data }) => data).catch(() => [])
      ))
      const byId = new Map()
      lists.flat().forEach((h) => {
        if (h.id_utilisateur !== user.id) byId.set(h.id_utilisateur, h)
      })
      setNeighbors([...byId.values()])
    } catch { setNeighbors([]) } finally { setNLoading(false) }
  }

  const startConv = async (voisinId) => {
    setStarting(true)
    try {
      const { data } = await api.post('/conversations', { participants: [voisinId] })
      navigate(`/messages/${data._id}`)
    } catch { /* ignore */ } finally { setStarting(false) }
  }

  const filteredNeighbors = neighbors.filter((n) =>
    !nSearch || `${n.prenom} ${n.nom}`.toLowerCase().includes(nSearch.toLowerCase())
  )

  const load = useCallback(() => {
    api.get('/conversations')
      .then(({ data }) => setConversations(data.conversations ?? data.data ?? data ?? []))
      .catch(() => setConversations([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const socket = getSocket()
    if (socket) socket.on('message:new', load)
    return () => { getSocket()?.off('message:new', load) }
  }, [load])

  const getOtherParticipant = (conv) => {
    if (!conv.participants?.length) return null
    return conv.participants.find(
      (p) => (p.id ?? p.id_utilisateur) !== (user?.id ?? user?.id_utilisateur)
    )
  }

  const totalUnread = conversations.reduce((sum, c) => sum + (c.non_lus ?? 0), 0)

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-gray-500 text-sm">{conversations.length} conversation(s)</p>
          {totalUnread > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {totalUnread} non lu{totalUnread > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <SocketStatus />
          <button onClick={openNew}
            className="flex items-center gap-1.5 bg-[#1a4a3a] hover:bg-[#0f2e24] text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Nouvelle
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <MessageCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucune conversation.</p>
          <p className="text-sm text-gray-400 mt-1">Contactez un voisin depuis une annonce.</p>
        </div>
      ) : (
        conversations.map((conv) => {
          const other   = getOtherParticipant(conv)
          const otherId = other?.id ?? other?.id_utilisateur ?? null
          const name    = other ? `${other.prenom} ${other.nom}` : 'Voisin'
          const online  = otherId ? isOnline(otherId) : false
          const unread  = conv.non_lus ?? 0
          const preview = conv.dernier_message
            ? (conv.dernier_message_type === 'image' ? 'Photo' : conv.dernier_message)
            : 'Aucun message'

          return (
            <Link
              key={conv._id ?? conv.id}
              to={`/messages/${conv._id ?? conv.id}`}
              className={`flex items-center gap-3 bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow ${unread > 0 ? 'border-[#34d399]/50' : 'border-gray-100'}`}
            >
              <div className="relative shrink-0">
                <div className="w-11 h-11 bg-[#1a4a3a] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {name[0]?.toUpperCase() ?? '?'}
                </div>
                {otherId && <OnlineBadge userId={otherId} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className={`truncate ${unread > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
                    {name}
                    {online && <span className="ml-1.5 text-xs text-green-500 font-normal">● En ligne</span>}
                  </p>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">
                    {relativeTime(conv.date_dernier_message)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className={`text-sm truncate ${unread > 0 ? 'text-gray-700' : 'text-gray-400'}`}>
                    {preview}
                  </p>
                  {unread > 0 && (
                    <span className="shrink-0 bg-[#1a4a3a] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )
        })
      )}

      {/* Modal nouvelle conversation */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Nouvelle conversation</h3>
              <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={nSearch} onChange={(e) => setNSearch(e.target.value)} autoFocus
                  placeholder="Rechercher un voisin..."
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]" />
              </div>
            </div>
            <div className="overflow-y-auto p-2">
              {nLoading ? (
                <p className="text-center text-sm text-gray-400 py-6">Chargement...</p>
              ) : filteredNeighbors.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">Aucun voisin trouvé dans votre quartier.</p>
              ) : (
                filteredNeighbors.map((n) => (
                  <button key={n.id_utilisateur} onClick={() => startConv(n.id_utilisateur)} disabled={starting}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#f0faf5] transition-colors text-left disabled:opacity-50">
                    <span className="w-9 h-9 bg-[#1a4a3a] rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {n.prenom?.[0]}{n.nom?.[0]}
                    </span>
                    <span className="text-sm text-gray-700">{n.prenom} {n.nom}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SocketStatus() {
  const connected = useSocketStore((s) => s.connected)
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400">
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-300'}`} />
      {connected ? 'Temps réel actif' : 'Temps réel indisponible'}
    </div>
  )
}
