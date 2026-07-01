import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie } from 'lucide-react'

const KEY = 'quartio_cookie_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(() => {
    try { return !localStorage.getItem(KEY) } catch { return false }
  })

  const accept = () => {
    try { localStorage.setItem(KEY, new Date().toISOString()) } catch { /* ignore */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:max-w-md z-[100] bg-white border border-gray-200 shadow-xl rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 bg-[#f0faf5] text-[#1a4a3a] rounded-xl flex items-center justify-center shrink-0">
          <Cookie className="w-5 h-5" />
        </span>
        <div className="text-sm text-gray-600">
          <p className="font-medium text-gray-800 mb-0.5">Cookies</p>
          <p>
            Quartio n'utilise que des cookies techniques indispensables (connexion, préférences).
            En savoir plus dans les <Link to="/mentions-legales" className="text-[#2d7a5f] underline">mentions légales</Link>.
          </p>
          <button onClick={accept}
            className="mt-3 bg-[#1a4a3a] hover:bg-[#0f2e24] text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  )
}
