import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Coins, FileText, AlertTriangle, Megaphone, CalendarDays, Vote } from 'lucide-react'
import api from '../services/api'

const StatCard = ({ label, value, color, sub, urgent, icon: Icon }) => (
  <div className={`bg-white rounded-xl p-5 shadow-sm border flex items-center gap-4 ${urgent ? 'border-red-200' : 'border-slate-100'}`}>
    <div className={`w-12 h-12 ${color} rounded-xl shrink-0 flex items-center justify-center text-slate-700`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <p className={`text-2xl font-bold ${urgent ? 'text-red-600' : 'text-slate-800'}`}>{value ?? '...'}</p>
      <p className="text-sm text-slate-500">{label}</p>
      {sub && <p className={`text-xs mt-0.5 ${urgent ? 'text-red-400' : 'text-slate-400'}`}>{sub}</p>}
    </div>
  </div>
)

export default function DashboardPage() {
  const [kpis, setKpis]               = useState({})
  const [urgents, setUrgents]         = useState([])
  const [oldStats, setOldStats]       = useState({})
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    const loadAll = async () => {
      const [statsRes, basicRes] = await Promise.allSettled([
        api.get('/stats'),
        Promise.allSettled([
          api.get('/utilisateurs'),
          api.get('/incidents'),
          api.get('/votes'),
          api.get('/annonces'),
          api.get('/evenements'),
        ]),
      ])

      if (statsRes.value) {
        const d = statsRes.value.data
        setKpis(d.kpis ?? {})
        setUrgents(d.incidents_urgents ?? [])
      }

      if (basicRes.value) {
        const [users, incidents, votes, annonces, evenements] = basicRes.value
        setOldStats({
          users:      users.value?.data?.pagination?.total      ?? users.value?.data?.data?.length      ?? '-',
          incidents:  incidents.value?.data?.pagination?.total  ?? incidents.value?.data?.data?.length  ?? '-',
          votes:      votes.value?.data?.pagination?.total      ?? votes.value?.data?.data?.length      ?? '-',
          annonces:   annonces.value?.data?.pagination?.total   ?? annonces.value?.data?.data?.length   ?? '-',
          evenements: evenements.value?.data?.pagination?.total ?? evenements.value?.data?.data?.length ?? '-',
        })
      }
      setLoading(false)
    }
    loadAll()
  }, [])

  const prioriteColor = (p) => ({
    critique: 'bg-red-100 text-red-700',
    haute:    'bg-orange-100 text-orange-700',
    normale:  'bg-yellow-100 text-yellow-700',
    basse:    'bg-green-100 text-green-700',
  }[p] ?? 'bg-gray-100 text-gray-600')

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold">Vue d'ensemble</h2>
        <p className="text-white/60 text-sm mt-1">Tableau de bord administrateur Quartio</p>
      </div>

      {/* KPIs enrichis */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Utilisateurs"      value={kpis.total_utilisateurs ?? oldStats.users}      color="bg-blue-50" sub={kpis.nouveaux_30j != null ? `+${kpis.nouveaux_30j} ce mois` : undefined} icon={Users} />
        <StatCard label="Points en circulation" value={kpis.points_en_circulation != null ? `${kpis.points_en_circulation.toLocaleString('fr-FR')} pts` : '-'} color="bg-yellow-50" icon={Coins} />
        <StatCard label="Contrats en attente" value={kpis.contrats_en_attente ?? '-'} color="bg-purple-50" sub={kpis.taux_completion != null ? `${kpis.taux_completion}% complétés` : undefined} icon={FileText} />
        <StatCard label="Incidents ouverts"  value={kpis.total_incidents ?? oldStats.incidents}    color="bg-red-50" icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Annonces"   value={kpis.total_annonces   ?? oldStats.annonces}   color="bg-green-50"  icon={Megaphone} />
        <StatCard label="Événements" value={kpis.total_evenements ?? oldStats.evenements} color="bg-indigo-50" icon={CalendarDays} />
        <StatCard label="Votes"      value={oldStats.votes}                                color="bg-orange-50" icon={Vote} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Incidents urgents */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700">Incidents urgents</h3>
            <Link to="/incidents" className="text-xs text-indigo-600 hover:underline">Voir tout</Link>
          </div>
          {urgents.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Aucun incident urgent en cours</p>
          ) : (
            <div className="space-y-2">
              {urgents.map((inc) => (
                <div key={inc._id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{inc.titre}</p>
                    <p className="text-xs text-slate-400">{new Date(inc.createdAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${prioriteColor(inc.priorite)}`}>
                      {inc.priorite}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                      {inc.statut}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions rapides + état services */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-700 mb-3">Actions rapides</h3>
            <div className="space-y-1">
              {[
                { to: '/statistiques', label: 'Voir les statistiques' },
                { to: '/quartiers',    label: 'Gérer les quartiers' },
                { to: '/incidents',    label: 'Traiter les incidents' },
                { to: '/utilisateurs', label: 'Gérer les utilisateurs' },
              ].map(({ to, label }) => (
                <Link key={to} to={to}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition text-sm text-slate-700">
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-700 mb-3">État des services</h3>
            <div className="space-y-2.5">
              {[
                { label: 'API Backend',  ok: !loading },
                { label: 'MongoDB',      ok: kpis.total_annonces != null },
                { label: 'PostgreSQL',   ok: kpis.total_utilisateurs != null },
                { label: 'Neo4j',        ok: !loading },
              ].map(({ label, ok }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{label}</span>
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-green-600' : 'text-red-500'}`}>
                    <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-400' : 'bg-gray-300 animate-pulse'}`} />
                    {loading ? '...' : ok ? 'Opérationnel' : 'Indisponible'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
