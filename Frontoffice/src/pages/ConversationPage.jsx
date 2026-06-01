import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import useAuthStore from '../store/authStore'
import useSocketStore from '../store/socketStore'
import { getSocket } from '../services/socket'
import OnlineBadge from '../components/ui/OnlineBadge'

export default function ConversationPage() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const user       = useAuthStore((s) => s.user)
  const { joinConversation, leaveConversation, emitTypingStart, emitTypingStop, isOnline } = useSocketStore()

  const [messages,  setMessages]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [conv,      setConv]      = useState(null)
  const [text,      setText]      = useState('')
  const [sending,   setSending]   = useState(false)
  const [typing,    setTyping]    = useState(false)   // quelqu'un tape de l'autre côté
  const bottomRef  = useRef(null)
  const typingTimer = useRef(null)

  // ─── Chargement initial ────────────────────────────────────────────────────
  const loadMessages = useCallback(async (silent = false) => {
    try {
      const [msgRes, convRes] = await Promise.allSettled([
        api.get(`/conversations/${id}/messages`),
        api.get(`/conversations/${id}`),
      ])
      if (msgRes.value) setMessages(msgRes.value.data?.messages ?? msgRes.value.data ?? [])
      if (convRes.value) setConv(convRes.value.data)
      if (!silent) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch { navigate('/messages') }
    if (!silent) setLoading(false)
  }, [id])

  useEffect(() => {
    loadMessages()
    joinConversation(id)

    const socket = getSocket()
    if (socket) {
      // Nouveau message reçu en temps réel
      socket.on('message:new', (data) => {
        if (data.conversationId === id) {
          setMessages((prev) => [...prev, data.message])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
      })

      // Indicateur de frappe
      socket.on('typing:start', (data) => {
        if (data.conversationId === id) setTyping(true)
      })
      socket.on('typing:stop', (data) => {
        if (data.conversationId === id) setTyping(false)
      })
    }

    return () => {
      leaveConversation(id)
      const s = getSocket()
      if (s) {
        s.off('message:new')
        s.off('typing:start')
        s.off('typing:stop')
      }
    }
  }, [id])

  // ─── Envoi de message ──────────────────────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    emitTypingStop(id)
    try {
      const { data } = await api.post(`/conversations/${id}/messages`, {
        contenu: text.trim(),
        type: 'texte',
      })
      setText('')
      // Ajouter localement (le socket le re-diffusera aux autres)
      setMessages((prev) => [...prev, data])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch {}
    setSending(false)
  }

  // ─── Indicateur de frappe ─────────────────────────────────────────────────
  const handleTextChange = (e) => {
    setText(e.target.value)
    emitTypingStart(id)
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => emitTypingStop(id), 1500)
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const isOwn = (msg) =>
    (msg.auteur_id ?? msg.expediteur_id ?? msg.id_auteur) === (user?.id ?? user?.id_utilisateur)

  const getOtherUser = () => {
    if (!conv?.participants) return null
    return conv.participants.find((p) => p.id !== (user?.id ?? user?.id_utilisateur))
  }

  const other = getOtherUser()

  return (
    <div className="max-w-2xl flex flex-col h-[calc(100vh-140px)]">

      {/* Header conversation */}
      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => navigate(-1)} className="text-sm text-[#2d7a5f] hover:underline shrink-0">
          ←
        </button>
        {other && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative shrink-0">
              <div className="w-9 h-9 bg-[#1a4a3a] rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {other.prenom?.[0]}{other.nom?.[0]}
              </div>
              <OnlineBadge userId={other.id ?? other.id_utilisateur} />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-800 truncate">{other.prenom} {other.nom}</p>
              <p className="text-xs text-gray-400">
                {isOnline(other.id ?? other.id_utilisateur) ? (
                  <span className="text-green-500 font-medium">En ligne</span>
                ) : 'Hors ligne'}
              </p>
            </div>
          </div>
        )}
        {!other && (
          <button onClick={() => navigate(-1)} className="text-sm text-[#2d7a5f] hover:underline">
            ← Retour aux messages
          </button>
        )}
      </div>

      {/* Zone de messages */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Chargement…</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              Aucun message. Démarrez la conversation !
            </div>
          ) : (
            messages.map((msg, i) => (
              <MessageBubble key={msg.id ?? msg._id ?? i} msg={msg} own={isOwn(msg)} />
            ))
          )}

          {/* Indicateur de frappe */}
          {typing && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-500 px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm flex items-center gap-1.5">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="border-t border-gray-100 p-3 flex gap-2">
          <input
            value={text}
            onChange={handleTextChange}
            placeholder="Votre message…"
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="bg-[#1a4a3a] hover:bg-[#0f2e24] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {sending ? '…' : '→'}
          </button>
        </form>
      </div>
    </div>
  )
}

function MessageBubble({ msg, own }) {
  const time = msg.created_at ?? msg.createdAt
  return (
    <div className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs lg:max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
        own
          ? 'bg-[#1a4a3a] text-white rounded-br-sm'
          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
      }`}>
        <p>{msg.contenu}</p>
        {time && (
          <p className={`text-xs mt-1 ${own ? 'text-white/50' : 'text-gray-400'}`}>
            {new Date(time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  )
}
