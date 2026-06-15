import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Megaphone, CalendarDays, Vote, Coins, AlertTriangle, User, Mail, ShieldCheck, ArrowRight } from 'lucide-react'
import useAuthStore from '../store/authStore'
import api from '../services/api'

const StatCard = ({ label, value, to, color, icon: Icon }) => (
  <Link to={to} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex items-center gap-4">
    <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center text-gray-700`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-800">{value ?? '...'}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  </Link>
)

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { t } = useTranslation()
  const [stats, setStats] = useState({})

  useEffect(() => {
    const load = async () => {
      try {
        const [annonces, evenements, votes] = await Promise.allSettled([
          api.get('/annonces?limit=1'),
          api.get('/evenements?limit=1'),
          api.get('/votes?limit=1'),
        ])
        setStats({
          annonces:  annonces.value?.data?.pagination?.total  ?? '-',
          evenements: evenements.value?.data?.pagination?.total ?? '-',
          votes:     votes.value?.data?.pagination?.total     ?? '-',
        })
      } catch {}
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#1a4a3a] to-[#2d7a5f] rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-bold">{t('dashboard.greeting', { name: user?.prenom ?? 'voisin' })}</h2>
        <p className="text-white/70 mt-1">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('dashboard.annonces')}  value={stats.annonces}   to="/annonces"  color="bg-blue-50" icon={Megaphone} />
        <StatCard label={t('dashboard.events')}    value={stats.evenements} to="/evenements" color="bg-purple-50" icon={CalendarDays} />
        <StatCard label={t('dashboard.votes')}     value={stats.votes}      to="/votes"     color="bg-yellow-50" icon={Vote} />
        <StatCard label={t('dashboard.myPoints')}
          value={user?.points_solde != null ? `${user.points_solde} pts` : '-'}
          to="/profil" color="bg-amber-50" icon={Coins} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">{t('dashboard.quickAccess')}</h3>
          <div className="space-y-2">
            {[
              { to: '/annonces',   label: t('dashboard.postAd'),    icon: Megaphone },
              { to: '/evenements', label: t('dashboard.seeEvents'), icon: CalendarDays },
              { to: '/incidents',  label: t('dashboard.reportIssue'), icon: AlertTriangle },
              { to: '/votes',      label: t('dashboard.joinVote'),  icon: Vote },
            ].map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#f0faf5] transition-colors text-sm text-gray-700">
                <Icon className="w-4 h-4 text-[#2d7a5f] shrink-0" />
                {label}
                <ArrowRight className="w-4 h-4 ml-auto text-gray-300" />
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">{t('dashboard.myAccount')}</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400" />{t('dashboard.name')}</span>
              <span className="font-medium text-gray-800">{user?.nom} {user?.prenom}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" />{t('dashboard.email')}</span>
              <span className="font-medium text-gray-800">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-gray-400" />{t('dashboard.role')}</span>
              <span className="bg-[#1a4a3a]/10 text-[#1a4a3a] text-xs font-medium px-2 py-0.5 rounded-full capitalize">
                {user?.role ?? t('common.resident')}
              </span>
            </div>
            <Link to="/profil" className="block text-center mt-2 text-[#2d7a5f] font-medium hover:underline">
              {t('dashboard.editProfile')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
