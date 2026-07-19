import { useRef, useState, useCallback } from 'react'
import TinderCard from 'react-tinder-card'
import { PartyPopper, CheckCircle2, X, Heart, MapPin, CalendarDays, Users } from 'lucide-react'
import api from '../../services/api'

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null

export default function SwipeView({ evenements }) {
  const [index, setIndex]       = useState(evenements.length - 1)
  const [joined, setJoined]     = useState([])
  const [skipped, setSkipped]   = useState([])
  const [feedback, setFeedback] = useState(null)
  const [finished, setFinished] = useState(false)

  const cardRefs = useRef([])
  if (cardRefs.current.length !== evenements.length) {
    cardRefs.current = evenements.map((_, i) => cardRefs.current[i] ?? null)
  }

  const showFeedback = (type) => {
    setFeedback(type)
    setTimeout(() => setFeedback(null), 600)
  }

  const onSwipe = useCallback(async (direction, ev) => {
    const id = ev._id ?? ev.id
    if (direction === 'right') {
      showFeedback('join')
      try { await api.post(`/evenements/${id}/participer`) } catch {}
      try { await api.post(`/evenements/${id}/swipe`, { direction: 'right' }) } catch {}
      setJoined((j) => [...j, ev])
    } else {
      showFeedback('skip')
      try { await api.post(`/evenements/${id}/swipe`, { direction: 'left' }) } catch {}
      setSkipped((s) => [...s, ev])
    }
  }, [])

  const onCardLeftScreen = useCallback((idx) => {
    setIndex((prev) => {
      const next = prev - 1
      if (next < 0) setFinished(true)
      return next
    })
  }, [])

  const swipe = async (dir) => {
    if (index < 0 || !cardRefs.current[index]) return
    await cardRefs.current[index].swipe(dir)
  }

  if (finished || evenements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <PartyPopper className="w-12 h-12 text-[#34d399]" />
        <h3 className="text-xl font-bold text-gray-800">C'est tout !</h3>
        <p className="text-gray-500 text-sm">
          Vous avez rejoint <span className="font-semibold text-[#1a4a3a]">{joined.length}</span> événement(s)
        </p>
        {joined.length > 0 && (
          <div className="bg-[#f0faf5] rounded-xl p-4 w-full max-w-sm space-y-2">
            {joined.map((ev) => (
              <div key={ev._id ?? ev.id} className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-[#34d399] shrink-0" />
                <span>{ev.titre}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const current = evenements[index]
  const total   = evenements.length
  const done    = total - 1 - index

  return (
    <div className="flex flex-col items-center select-none">

      <div className="w-full max-w-sm mb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{done} / {total} vus</span>
          <span>{joined.length} rejoint(s)</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#34d399] rounded-full transition-all duration-300"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="relative w-full max-w-sm" style={{ height: 420 }}>
        {feedback === 'join' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-green-400/20 border-4 border-green-400 pointer-events-none">
            <span className="text-green-500 font-bold text-3xl rotate-[-20deg] border-4 border-green-500 px-4 py-1 rounded-xl">
              JE PARTICIPE
            </span>
          </div>
        )}
        {feedback === 'skip' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-red-400/20 border-4 border-red-400 pointer-events-none">
            <span className="text-red-500 font-bold text-3xl rotate-[20deg] border-4 border-red-500 px-4 py-1 rounded-xl">
              PASSER
            </span>
          </div>
        )}

        {evenements.map((ev, i) => (
          <TinderCard
            key={ev._id ?? ev.id}
            ref={(el) => (cardRefs.current[i] = el)}
            onSwipe={(dir) => onSwipe(dir, ev)}
            onCardLeftScreen={() => onCardLeftScreen(i)}
            preventSwipe={['up', 'down']}
            className="absolute inset-0"
          >
            <EventCard ev={ev} />
          </TinderCard>
        ))}
      </div>

      <div className="flex items-center gap-6 mt-6">
        <button
          onClick={() => swipe('left')}
          className="w-14 h-14 rounded-full bg-white border-2 border-red-300 text-red-400 shadow-md hover:scale-110 hover:border-red-400 transition-transform flex items-center justify-center"
          title="Passer"
        >
          <X className="w-6 h-6" />
        </button>
        <button
          onClick={() => swipe('right')}
          className="w-16 h-16 rounded-full bg-[#1a4a3a] text-white shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
          title="Participer"
        >
          <Heart className="w-7 h-7" />
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Swipez à droite pour participer · à gauche pour passer
      </p>
    </div>
  )
}

function EventCard({ ev }) {
  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null

  const monthStr = ev.date_debut
    ? new Date(ev.date_debut).toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase()
    : null
  const dayStr = ev.date_debut ? new Date(ev.date_debut).getDate() : null

  return (
    <div className="w-full h-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden cursor-grab active:cursor-grabbing">
      <div className="bg-gradient-to-br from-[#1a4a3a] to-[#2d7a5f] h-40 flex items-center justify-center relative">
        <div className="text-center text-white">
          {monthStr ? (
            <>
              <p className="text-sm font-semibold opacity-80">{monthStr}</p>
              <p className="text-5xl font-bold leading-none">{dayStr}</p>
            </>
          ) : (
            <CalendarDays className="w-12 h-12 opacity-60" />
          )}
        </div>
        {ev.type && (
          <span className="absolute top-3 right-3 bg-white/20 text-white text-xs font-medium px-2.5 py-1 rounded-full">
            {ev.type}
          </span>
        )}
      </div>

      <div className="p-5 space-y-3">
        <h3 className="text-lg font-bold text-gray-800 leading-tight">{ev.titre}</h3>

        {ev.description && (
          <p className="text-sm text-gray-500 line-clamp-3">{ev.description}</p>
        )}

        <div className="space-y-1.5 pt-1">
          {ev.lieu && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{ev.lieu}</span>
            </div>
          )}
          {formatDate(ev.date_debut) && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span>{formatDate(ev.date_debut)}</span>
            </div>
          )}
          {ev.capacite_max && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users className="w-4 h-4 shrink-0" />
              <span>{ev.capacite_max} places max</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
