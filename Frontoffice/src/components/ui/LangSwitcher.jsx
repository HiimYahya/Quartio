import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'

export default function LangSwitcher({ compact = false }) {
  const { i18n } = useTranslation()
  const current  = i18n.language?.startsWith('fr') ? 'fr' : 'en'

  const toggle = () => i18n.changeLanguage(current === 'fr' ? 'en' : 'fr')

  if (compact) {
    return (
      <button
        onClick={toggle}
        className="flex items-center gap-1 text-xs font-medium text-white/60 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
        title="Changer de langue / Switch language"
      >
        <Languages className="w-3.5 h-3.5" />
        <span className="uppercase">{current === 'fr' ? 'EN' : 'FR'}</span>
      </button>
    )
  }

  return (
    <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
      {['fr', 'en'].map((lang) => (
        <button
          key={lang}
          onClick={() => i18n.changeLanguage(lang)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            current === lang
              ? 'bg-white text-[#1a4a3a] shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Languages className="w-3.5 h-3.5" />
          {lang === 'fr' ? 'Français' : 'English'}
        </button>
      ))}
    </div>
  )
}
