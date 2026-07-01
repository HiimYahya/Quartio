import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, MessageSquare, CalendarDays, FileText, Vote, AlertTriangle, Info, Check, Trash2 } from 'lucide-react'
import api from '../services/api'
import useSocketStore from '../store/socketStore'

const TYPE_ICON = {
  message:   MessageSquare,
  evenement: CalendarDays,
  contrat:   FileText,
  vote:      Vote,
  incident:  AlertTriangle,
  systeme:   Info,
}

// Où mène le clic sur une notification, selon la ressource liée.
function resourceLink(n) {
  const id = n.id_ressource
  switch (n.type_ressource) {
    case 'annonce':   return id ? `/annonces/${id}` : '/annonces'
    case 'evenement': return id ? `/evenements/${id}` : '/evenements'
    case 'contrat':   return id ? `/contrats/${id}` : '/contrats'
    case 'message':   return id ? `/messages/${id}` : '/messages'
    case 'vote':      return '/votes'
    default:          return null
  }
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const { refreshUnread, setUnread } = useSocketStore()

  const load = () => {
    setLoading(true)
    api.get('/notifications?limit=50')
      .then(({ data }) => setItems(data.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(); refreshUnread() }, [])

  const markRead = async (n) => {
    if (!n.est_lue) {
      try { await api.put(`/notifications/${n.id_notification}/lire`) } catch { /* ignore */ }
      setItems((v) => v.map((x) => x.id_notification === n.id_notification ? { ...x, est_lue: true } : x))
      refreshUnread()
    }
  }

  const openNotif = async (n) => {
    await markRead(n)
    const to = resourceLink(n)
    if (to) navigate(to)
  }

  const markAll = async () => {
    try { await api.put('/notifications/lire-tout') } catch { /* ignore */ }
    setItems((v) => v.map((x) => ({ ...x, est_lue: true })))
    setUnread(0)
  }

  const remove = async (id, e) => {
    e.stopPropagation()
    try { await api.delete(`/notifications/${id}`) } catch { /* ignore */ }
    setItems((v) => v.filter((x) => x.id_notification !== id))
    refreshUnread()
  }

  const unread = items.filter((n) => !n.est_lue).length

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#1a4a3a]" />
          <h2 className="text-lg font-bold text-gray-800">Notifications</h2>
          {unread > 0 && <span className="bg-[#1a4a3a] text-white text-xs font-semibold px-2 py-0.5 rounded-full">{unread}</span>}
        </div>
        {unread > 0 && (
          <button onClick={markAll} className="text-sm text-[#2d7a5f] font-medium hover:underline flex items-center gap-1">
            <Check className="w-4 h-4" /> Tout marquer comme lu
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Bell className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Aucune notification.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? Info
            return (
              <div
                key={n.id_notification}
                onClick={() => openNotif(n)}
                className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition-colors ${
                  n.est_lue ? 'bg-white border-gray-100 hover:bg-gray-50' : 'bg-[#f0faf5] border-[#34d399]/40 hover:bg-[#e6f7ef]'
                }`}
              >
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${n.est_lue ? 'bg-gray-100 text-gray-500' : 'bg-[#34d399]/20 text-[#1a4a3a]'}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.est_lue ? 'font-medium text-gray-700' : 'font-semibold text-gray-800'}`}>{n.titre}</p>
                  {n.contenu && <p className="text-sm text-gray-500 mt-0.5">{n.contenu}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {n.date_creation ? new Date(n.date_creation).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
                {!n.est_lue && <span className="w-2 h-2 rounded-full bg-[#34d399] mt-2 shrink-0" />}
                <button onClick={(e) => remove(n.id_notification, e)} title="Supprimer"
                  className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
