import { Outlet } from 'react-router-dom'
import Topbar from './Topbar'
import BottomNav from './BottomNav'
import AlertBanner from '../ui/AlertBanner'

export default function Layout() {
  return (
    <div className="h-screen bg-[#dfeee7] flex justify-center">
      {/* Colonne façon application mobile, centrée sur grand écran */}
      <div className="w-full max-w-xl bg-[#f7fbf9] flex flex-col h-full shadow-xl overflow-hidden">
        <Topbar />
        <AlertBanner />
        <main className="flex-1 overflow-y-auto px-4 py-4">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
