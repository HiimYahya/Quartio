import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Map, Megaphone, MessageSquare, User } from 'lucide-react'

const TABS = [
  { to: '/dashboard', key: 'nav.home',     label: 'Accueil',  icon: Home },
  { to: '/carte',     key: 'nav.map',      label: 'Carte',    icon: Map },
  { to: '/annonces',  key: 'nav.annonces', label: 'Annonces', icon: Megaphone },
  { to: '/messages',  key: 'nav.messages', label: 'Messages', icon: MessageSquare },
  { to: '/profil',    key: 'nav.profile',  label: 'Profil',   icon: User },
]

export default function BottomNav() {
  const { t } = useTranslation()
  return (
    <nav className="shrink-0 bg-white border-t border-gray-100 px-2 py-1.5 flex items-center justify-around">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-colors min-w-[56px] ${
              isActive ? 'text-[#1a4a3a]' : 'text-gray-400 hover:text-gray-600'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors ${isActive ? 'bg-[#34d399]/20' : ''}`}>
                <Icon className="w-5 h-5" />
              </span>
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
