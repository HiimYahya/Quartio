import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import AlertBanner from '../ui/AlertBanner'

export default function Layout() {
  return (
    <div className="h-screen bg-[#f0faf5] flex flex-col overflow-hidden">
      <Navbar />
      <AlertBanner />
      <main className="flex-1 overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-6">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  )
}
