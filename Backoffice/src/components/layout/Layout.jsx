import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

const titles = {
  '/dashboard':    'Dashboard',
  '/statistiques': 'Statistiques',
  '/utilisateurs': 'Gestion des utilisateurs',
  '/quartiers':    'Gestion des quartiers',
  '/incidents':    'Gestion des incidents',
  '/votes':        'Gestion des votes',
  '/evenements':   'Gestion des événements',
  '/annonces':     'Gestion des annonces',
  '/contrats':     'Gestion des contrats',
  '/console':      'Console Quartio-QL',
}

export default function Layout() {
  const { pathname } = useLocation()
  const title = Object.entries(titles).find(([p]) => pathname.startsWith(p))?.[1] ?? 'Admin'

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
          <span className="text-xs font-medium bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
            Administration
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
