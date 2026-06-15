import { NavLink, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, Map, Megaphone, CalendarDays, Vote, MessageSquare, FileText, AlertTriangle, User, LogOut, Coins } from 'lucide-react'
import useAuthStore from '../../store/authStore'
import LangSwitcher from '../ui/LangSwitcher'

const NAV_LINKS = [
  { to: '/dashboard',  key: 'nav.home',     icon: LayoutDashboard },
  { to: '/carte',      key: 'nav.map',      icon: Map },
  { to: '/annonces',   key: 'nav.annonces', icon: Megaphone },
  { to: '/evenements', key: 'nav.events',   icon: CalendarDays },
  { to: '/votes',      key: 'nav.votes',    icon: Vote },
  { to: '/messages',   key: 'nav.messages', icon: MessageSquare },
  { to: '/contrats',   key: 'nav.contracts', icon: FileText },
  { to: '/incidents',  key: 'nav.incidents', icon: AlertTriangle },
  { to: '/profil',     key: 'nav.profile',  icon: User },
]

export default function Sidebar() {
  const logout = useAuthStore((s) => s.logout)
  const user   = useAuthStore((s) => s.user)
  const { t }  = useTranslation()

  return (
    <aside className="w-64 bg-[#1a4a3a] flex flex-col h-full shadow-xl">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="w-9 h-9 bg-[#34d399] rounded-lg flex items-center justify-center text-[#1a4a3a] font-bold text-lg">
          Q
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-none">Quartio</p>
          <p className="text-white/50 text-xs">Votre quartier, connecté</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_LINKS.map(({ to, key, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-[#34d399]/20 text-[#34d399]'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {t(key)}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 pb-5 space-y-2">
        {user?.points_solde != null && (
          <Link
            to="/profil"
            className="flex items-center justify-between bg-white/10 hover:bg-white/15 transition-colors rounded-xl px-4 py-3"
          >
            <div>
              <p className="text-white/60 text-xs">Mon solde</p>
              <p className="text-white font-bold text-lg leading-none">{user.points_solde} pts</p>
            </div>
            <Coins className="w-6 h-6 text-[#34d399]" />
          </Link>
        )}
        <div className="flex items-center justify-between px-1">
          <LangSwitcher compact />
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-red-400 transition-all duration-150"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {t('nav.logout')}
        </button>
      </div>
    </aside>
  )
}
