import { useState } from 'react'
import { Send, X } from 'lucide-react'
import api from '../../services/api'

// Envoie un message privé à un utilisateur depuis le backoffice : crée (ou
// réutilise) la conversation privée admin <-> utilisateur puis poste le message.
export default function ContactUserModal({ user, onClose }) {
  const [texte,   setTexte]   = useState('')
  const [sending, setSending] = useState(false)
  const [error,   setError]   = useState(null)
  const [sent,    setSent]    = useState(false)

  const envoyer = async (e) => {
    e.preventDefault()
    if (!texte.trim()) return
    setError(null)
    setSending(true)
    try {
      const { data: conv } = await api.post('/conversations', { participants: [user.id] })
      await api.post(`/conversations/${conv._id ?? conv.id}/messages`, {
        contenu: texte.trim(),
        type: 'texte',
      })
      setSent(true)
      setTimeout(onClose, 1200)
    } catch (err) {
      setError(err.response?.data?.error ?? "Échec de l'envoi du message")
    }
    setSending(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-slate-800">Contacter {user.prenom} {user.nom}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Le message arrive dans sa messagerie Quartio, la conversation continue depuis votre compte.
        </p>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}
        {sent ? (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">Message envoyé.</p>
        ) : (
          <form onSubmit={envoyer} className="space-y-3">
            <textarea
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Votre message..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50 transition">
                Annuler
              </button>
              <button type="submit" disabled={sending || !texte.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm transition disabled:opacity-60 flex items-center justify-center gap-1.5">
                <Send className="w-3.5 h-3.5" /> {sending ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
