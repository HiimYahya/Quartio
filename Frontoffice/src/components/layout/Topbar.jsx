import { useLocation, Link } from 'react-router-dom'
import { Coins } from 'lucide-react'
import useAuthStore from '../../store/authStore'
import useSocketStore from '../../store/socketStore'

const titles = {
  '/dashboard':  'Tableau de bord',
  '/carte':      'Carte du quartier',
  '/annonces':   'Annonces',
  '/evenements': 'Événements',
  '/votes':      'Votes',
  '/messages':   'Messages',
  '/contrats':   'Contrats',
  '/incidents':  'Incidents',
  '/profil':     'Mon profil',
}

export default function Topbar() {
  const { pathname } = useLocation()
  const user      = useAuthStore((s) => s.user)
  const connected = useSocketStore((s) => s.connected)

  const title = Object.entries(titles).find(([path]) => pathname.startsWith(path))?.[1] ?? 'Quartio'

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h1 className="text-xl font-semibold text-[#1a4a3a]">{title}</h1>
      <div className="flex items-center gap-4">
        {user?.points_solde != null && (
          <Link
            to="/profil"
            className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold px-3 py-1.5 rounded-full hover:bg-amber-100 transition-colors"
            title="Mon solde de points"
          >
            <Coins className="w-4 h-4" />
            <span>{user.points_solde} pts</span>
          </Link>
        )}
        <Link to="/profil" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="relative">
            <div className="w-8 h-8 bg-[#1a4a3a] rounded-full flex items-center justify-center text-white text-sm font-semibold">
              {user ? `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}` : '?'}
            </div>
            {connected && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full" />
            )}
          </div>
          <span className="text-sm text-gray-700 font-medium">
            {user ? `${user.prenom} ${user.nom}` : '...'}
          </span>
        </Link>
      </div>
    </header>
  )
}
