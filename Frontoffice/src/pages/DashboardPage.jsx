import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Megaphone, CalendarDays, Vote, FileText, Coins, ArrowRight, MapPin } from 'lucide-react'
import useAuthStore from '../store/authStore'
import api from '../services/api'

const QUICK_ACTIONS = [
  { to: '/annonces',   label: 'Publier',    icon: Megaphone,    color: 'bg-emerald-50 text-emerald-700' },
  { to: '/evenements', label: 'Événements', icon: CalendarDays, color: 'bg-violet-50 text-violet-700' },
  { to: '/votes',      label: 'Votes',      icon: Vote,         color: 'bg-amber-50 text-amber-700' },
  { to: '/contrats',   label: 'Contrats',   icon: FileText,     color: 'bg-sky-50 text-sky-700' },
]

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { t } = useTranslation()
  const [annonces,   setAnnonces]   = useState([])
  const [evenements, setEvenements] = useState([])

  useEffect(() => {
    api.get('/annonces?limit=5').then(({ data }) => setAnnonces(data.data ?? [])).catch(() => {})
    api.get('/evenements?limit=5').then(({ data }) => setEvenements(data.data ?? [])).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">

      <div className="bg-gradient-to-br from-[#1a4a3a] to-[#2d7a5f] rounded-3xl p-6 md:p-8 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-white/70 text-sm">{t('dashboard.subtitle')}</p>
          <h2 className="text-2xl md:text-3xl font-bold mt-0.5">{t('dashboard.greeting', { name: user?.prenom ?? 'voisin' })}</h2>
        </div>
        <div className="flex items-center gap-2 bg-white/10 rounded-2xl px-5 py-3 w-fit">
          <Coins className="w-6 h-6 text-[#34d399]" />
          <span className="font-bold text-2xl">{user?.points_solde ?? '-'}</span>
          <span className="text-white/70">points</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 sm:gap-4 max-w-xl">
        {QUICK_ACTIONS.map(({ to, label, icon: Icon, color }) => (
          <Link key={to} to={to} className="flex flex-col items-center gap-2 group">
            <span className={`w-14 h-14 rounded-2xl flex items-center justify-center ${color} group-hover:scale-105 transition-transform`}>
              <Icon className="w-6 h-6" />
            </span>
            <span className="text-xs text-gray-600 font-medium text-center">{label}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 text-lg">Près de chez vous</h3>
            <Link to="/annonces" className="text-sm text-[#2d7a5f] font-medium flex items-center gap-0.5">
              Tout voir <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {annonces.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-2xl border border-gray-100 p-4 text-center">Aucune annonce pour le moment.</p>
          ) : (
            <div className="space-y-2.5">
              {annonces.map((a) => (
                <Link key={a._id} to={`/annonces/${a._id}`}
                  className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-3.5 hover:shadow-md transition-shadow">
                  <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
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
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 text-lg">Prochains événements</h3>
            <Link to="/evenements" className="text-sm text-[#2d7a5f] font-medium flex items-center gap-0.5">
              Tout voir <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {evenements.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-2xl border border-gray-100 p-4 text-center">Aucun événement à venir.</p>
          ) : (
            <div className="space-y-2.5">
              {evenements.map((e) => (
                <Link key={e._id} to={`/evenements/${e._id}`}
                  className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-3.5 hover:shadow-md transition-shadow">
                  <span className="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800 text-sm truncate">{e.titre}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      {e.date_debut ? new Date(e.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
                      {e.lieu ? <><MapPin className="w-3 h-3" /> {e.lieu}</> : null}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
