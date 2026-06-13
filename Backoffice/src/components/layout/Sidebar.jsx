import { NavLink } from 'react-router-dom'
import useAuthStore from '../../store/authStore'

// roles: undefined = tous, sinon tableau de rôles autorisés
const ALL_LINKS = [
  { to: '/dashboard',    icon: '⊞',  label: 'Dashboard' },
  { to: '/statistiques', icon: '📊', label: 'Statistiques', roles: ['admin'] },
  { to: '/console',      icon: '💻', label: 'Console QL',   roles: ['admin'] },
  { to: '/utilisateurs', icon: '👥', label: 'Utilisateurs', roles: ['admin'] },
  { to: '/quartiers',    icon: '🗺️', label: 'Quartiers',    roles: ['admin'] },
  { to: '/incidents',    icon: '⚠️', label: 'Incidents' },
  { to: '/signalements', icon: '🚩', label: 'Signalements' },
  { to: '/votes',        icon: '🗳️', label: 'Votes',        roles: ['admin'] },
  { to: '/evenements',   icon: '📅', label: 'Événements',   roles: ['admin'] },
  { to: '/annonces',     icon: '📋', label: 'Annonces' },
  { to: '/contrats',     icon: '📄', label: 'Contrats',     roles: ['admin'] },
]

export default function Sidebar() {
  const { admin, logout } = useAuthStore()
  const links = ALL_LINKS.filter((l) => !l.roles || l.roles.includes(admin?.role))

  return (
    <aside className="w-60 bg-slate-900 flex flex-col h-full shadow-xl shrink-0">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">Q</div>
        <div>
          <p className="text-white font-bold text-sm leading-none">Quartio Admin</p>
          <p className="text-white/40 text-xs mt-0.5">Back-office</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map(({ to, icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <span className="w-5 text-center text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-4 border-t border-white/10 pt-3 space-y-2">
        <div className="px-3 py-2">
          <p className="text-white/80 text-xs font-medium truncate">{admin?.prenom} {admin?.nom}</p>
          <p className="text-white/40 text-xs truncate">{admin?.email}</p>
          <span className={`mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
            admin?.role === 'admin' ? 'bg-indigo-500/30 text-indigo-200' : 'bg-amber-500/30 text-amber-200'
          }`}>
            {admin?.role === 'admin' ? 'Administrateur' : 'Modérateur'}
          </span>
        </div>
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-red-400 transition-all">
          <span className="w-5 text-center">🚪</span>
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
