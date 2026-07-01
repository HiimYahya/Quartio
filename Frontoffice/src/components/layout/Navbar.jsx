import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Coins, Menu, X, LogOut, Bell } from 'lucide-react'
import useAuthStore from '../../store/authStore'
import useSocketStore from '../../store/socketStore'
import LangSwitcher from '../ui/LangSwitcher'

const NAV_LINKS = [
  { to: '/dashboard',  key: 'nav.home',      fallback: 'Accueil' },
  { to: '/annonces',   key: 'nav.annonces',  fallback: 'Annonces' },
  { to: '/evenements', key: 'nav.events',    fallback: 'Événements' },
  { to: '/votes',      key: 'nav.votes',     fallback: 'Votes' },
  { to: '/messages',   key: 'nav.messages',  fallback: 'Messages' },
  { to: '/contrats',   key: 'nav.contracts', fallback: 'Contrats' },
]

export default function Navbar() {
  const { t }     = useTranslation()
  const user      = useAuthStore((s) => s.user)
  const logout    = useAuthStore((s) => s.logout)
  const connected = useSocketStore((s) => s.connected)
  const unreadNotifs = useSocketStore((s) => s.unreadNotifs)
  const [open, setOpen] = useState(false)

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-[#34d399]/15 text-[#1a4a3a]' : 'text-gray-500 hover:text-[#1a4a3a] hover:bg-gray-100'
    }`

  return (
    <header className="shrink-0 bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        {/* Marque */}
        <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
          <div className="w-9 h-9 bg-[#1a4a3a] rounded-xl flex items-center justify-center text-[#34d399] font-bold">Q</div>
          <span className="font-bold text-[#1a4a3a] text-lg leading-none hidden sm:block">Quartio</span>
        </Link>

        {/* Liens (desktop) */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV_LINKS.map(({ to, key, fallback }) => (
            <NavLink key={to} to={to} className={linkClass}>{t(key, fallback)}</NavLink>
          ))}
        </nav>

        {/* Côté droit */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user?.points_solde != null && (
            <Link to="/profil" title="Mon solde de points"
              className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold px-2.5 py-1 rounded-full hover:bg-amber-100 transition-colors">
              <Coins className="w-4 h-4" />
              <span>{user.points_solde}</span>
            </Link>
          )}
          <Link to="/notifications" className="relative shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-[#1a4a3a] hover:bg-gray-100 transition-colors" title="Notifications">
            <Bell className="w-5 h-5" />
            {unreadNotifs > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadNotifs > 9 ? '9+' : unreadNotifs}
              </span>
            )}
          </Link>
          <div className="hidden md:block"><LangSwitcher compact /></div>
          <Link to="/profil" className="relative shrink-0" title="Mon profil">
            <div className="w-9 h-9 bg-[#1a4a3a] rounded-full flex items-center justify-center text-white text-sm font-semibold">
              {user ? `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}` : '?'}
            </div>
            {connected && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full" />}
          </Link>
          <button onClick={logout} title={t('nav.logout', 'Déconnexion')}
            className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
          {/* Burger (mobile) */}
          <button onClick={() => setOpen((v) => !v)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-gray-600 hover:bg-gray-100">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Menu mobile déroulant */}
      {open && (
        <nav className="md:hidden border-t border-gray-100 px-4 py-2 space-y-1">
          {NAV_LINKS.map(({ to, key, fallback }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2.5 rounded-lg text-sm font-medium ${isActive ? 'bg-[#34d399]/15 text-[#1a4a3a]' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t(key, fallback)}
            </NavLink>
          ))}
          <div className="flex items-center justify-between px-3 py-2">
            <LangSwitcher compact />
            <button onClick={logout} className="flex items-center gap-2 text-sm text-red-500">
              <LogOut className="w-4 h-4" /> {t('nav.logout', 'Déconnexion')}
            </button>
          </div>
        </nav>
      )}
    </header>
  )
}
