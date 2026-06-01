import { useEffect, useState } from 'react'
import api from '../services/api'

const StatCard = ({ label, value, icon, color, sub }) => (
  <div className={`bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center gap-4`}>
    <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center text-2xl shrink-0`}>{icon}</div>
    <div>
      <p className="text-2xl font-bold text-slate-800">{value ?? '…'}</p>
      <p className="text-sm text-slate-500">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
)

export default function DashboardPage() {
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [users, incidents, votes, annonces, evenements] = await Promise.allSettled([
        api.get('/utilisateurs'),
        api.get('/incidents'),
        api.get('/votes'),
        api.get('/annonces'),
        api.get('/evenements'),
      ])
      setStats({
        users:      users.value?.data?.pagination?.total      ?? users.value?.data?.data?.length      ?? '—',
        incidents:  incidents.value?.data?.pagination?.total  ?? incidents.value?.data?.data?.length  ?? '—',
        votes:      votes.value?.data?.pagination?.total      ?? votes.value?.data?.data?.length      ?? '—',
        annonces:   annonces.value?.data?.pagination?.total   ?? annonces.value?.data?.data?.length   ?? '—',
        evenements: evenements.value?.data?.pagination?.total ?? evenements.value?.data?.data?.length ?? '—',
        incidentsOuverts: incidents.value?.data?.data?.filter((i) => i.statut === 'ouvert')?.length ?? '—',
      })
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold">Vue d'ensemble</h2>
        <p className="text-white/60 text-sm mt-1">Tableau de bord administrateur Quartio</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Utilisateurs"  value={stats.users}      icon="👥" color="bg-blue-50"   />
        <StatCard label="Incidents"     value={stats.incidents}  icon="⚠️" color="bg-red-50"    sub={`${stats.incidentsOuverts} ouverts`} />
        <StatCard label="Votes actifs"  value={stats.votes}      icon="🗳️" color="bg-yellow-50" />
        <StatCard label="Annonces"      value={stats.annonces}   icon="📋" color="bg-green-50"  />
        <StatCard label="Événements"    value={stats.evenements} icon="📅" color="bg-purple-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-semibold text-slate-700 mb-3">Actions rapides</h3>
          <div className="space-y-2">
            {[
              { href: '/quartiers',    icon: '🗺️', label: 'Gérer les quartiers' },
              { href: '/incidents',    icon: '⚠️', label: 'Traiter les incidents' },
              { href: '/utilisateurs', icon: '👥', label: 'Gérer les utilisateurs' },
              { href: '/contrats',     icon: '📄', label: 'Valider les contrats' },
            ].map(({ href, icon, label }) => (
              <a key={href} href={href}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition text-sm text-slate-700">
                <span>{icon}</span>{label}
              </a>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-semibold text-slate-700 mb-3">État des services</h3>
          <div className="space-y-3">
            {[
              { label: 'API Backend',  ok: stats.annonces !== '—' },
              { label: 'MongoDB',      ok: stats.annonces !== '—' },
              { label: 'PostgreSQL',   ok: stats.users    !== '—' },
              { label: 'Neo4j',        ok: stats.annonces !== '—' },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{label}</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-green-600' : 'text-red-500'}`}>
                  <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'}`} />
                  {ok ? 'Opérationnel' : 'Indisponible'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
