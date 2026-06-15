import { Check, X } from 'lucide-react'
import { PASSWORD_RULES } from '../../utils/passwordPolicy'

const LABELS = ['Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort']
const COLORS = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500']

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null

  const score = PASSWORD_RULES.reduce((acc, r) => acc + (r.test(password) ? 1 : 0), 0)

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${score >= n ? COLORS[score] : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className="text-xs text-gray-500 mb-1">{LABELS[score]}</p>
      <ul className="text-xs text-gray-400 space-y-0.5">
        {PASSWORD_RULES.map(({ label, test }) => (
          <li key={label} className={`flex items-center gap-1.5 ${test(password) ? 'text-green-600' : ''}`}>
            {test(password) ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0 text-gray-300" />}
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}
