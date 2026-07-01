import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20">
      <div className="w-16 h-16 bg-[#f0faf5] text-[#1a4a3a] rounded-2xl flex items-center justify-center mb-4">
        <Compass className="w-8 h-8" />
      </div>
      <p className="text-5xl font-bold text-[#1a4a3a]">404</p>
      <h1 className="text-lg font-semibold text-gray-800 mt-2">Page introuvable</h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">Cette page n'existe pas ou a été déplacée.</p>
      <Link to="/dashboard" className="bg-[#1a4a3a] hover:bg-[#0f2e24] text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
        Retour à l'accueil
      </Link>
    </div>
  )
}
