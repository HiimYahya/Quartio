import useSocketStore from '../../store/socketStore'

export default function OnlineBadge({ userId, className = '' }) {
  const online = useSocketStore((s) => s.isOnline(userId))

  if (!online) return null

  return (
    <span
      className={`absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full ${className}`}
      title="En ligne"
    />
  )
}
