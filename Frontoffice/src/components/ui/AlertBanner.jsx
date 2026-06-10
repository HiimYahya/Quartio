import useSocketStore from '../../store/socketStore'

const ALERT_STYLES = {
  incident: { bg: 'bg-red-500',    icon: '🚨', label: 'Incident urgent' },
  contrat:  { bg: 'bg-amber-500',  icon: '✍️',  label: 'Signature requise' },
  vote:     { bg: 'bg-indigo-500', icon: '🗳️',  label: 'Nouveau vote' },
  evenement:{ bg: 'bg-green-600',  icon: '📅',  label: 'Nouvel événement' },
}

export default function AlertBanner() {
  const alerts       = useSocketStore((s) => s.alerts)
  const dismissAlert = useSocketStore((s) => s.dismissAlert)

  if (alerts.length === 0) return null

  return (
    <div className="space-y-1 px-4 pt-2">
      {alerts.map((alert) => {
        const style = ALERT_STYLES[alert.type] ?? { bg: 'bg-gray-600', icon: '🔔', label: 'Alerte' }
        return (
          <div key={alert.at}
            className={`${style.bg} text-white text-sm rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 shadow`}>
            <div className="flex items-center gap-2 min-w-0">
              <span>{style.icon}</span>
              <span className="font-semibold shrink-0">{style.label}</span>
              <span className="truncate opacity-90">
                {alert.titre ?? alert.message ?? ''}
              </span>
            </div>
            <button onClick={() => dismissAlert(alert.at)}
              className="shrink-0 opacity-70 hover:opacity-100 text-lg leading-none">×</button>
          </div>
        )
      })}
    </div>
  )
}
