import { Link } from 'react-router-dom'
import { Coins } from 'lucide-react'
import useAuthStore from '../../store/authStore'
import useSocketStore from '../../store/socketStore'

export default function Topbar() {
  const user      = useAuthStore((s) => s.user)
  const connected = useSocketStore((s) => s.connected)

  return (
    <header className="shrink-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
      <Link to="/dashboard" className="flex items-center gap-2">
        <div className="w-8 h-8 bg-[#1a4a3a] rounded-xl flex items-center justify-center text-[#34d399] font-bold">Q</div>
        <span className="font-bold text-[#1a4a3a] text-lg leading-none">Quartio</span>
      </Link>

      <div className="flex items-center gap-2.5">
        {user?.points_solde != null && (
          <Link
            to="/profil"
            className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold px-2.5 py-1 rounded-full hover:bg-amber-100 transition-colors"
            title="Mon solde de points"
          >
            <Coins className="w-4 h-4" />
            <span>{user.points_solde}</span>
          </Link>
        )}
        <Link to="/profil" className="relative">
          <div className="w-9 h-9 bg-[#1a4a3a] rounded-full flex items-center justify-center text-white text-sm font-semibold">
            {user ? `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}` : '?'}
          </div>
          {connected && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full" />
          )}
        </Link>
      </div>
    </header>
  )
}
