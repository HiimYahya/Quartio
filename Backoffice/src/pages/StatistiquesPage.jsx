import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { MapContainer, TileLayer, Polygon, Tooltip as LeafletTooltip } from 'react-leaflet'
import api from '../services/api'

const COLORS = ['#6366f1', '#34d399', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

// ─── GeoJSON string -> positions Leaflet ──────────────────────────────────────
const parseGeo = (g) => {
  if (!g) return null
  try {
    const coords = JSON.parse(g)?.geometry?.coordinates?.[0]
    return coords ? coords.map(([lng, lat]) => [lat, lng]) : null
  } catch { return null }
}

// ─── Couleur en fonction du score relatif (0 -> bleu pâle, max -> rouge intense) ──
const heatColor = (score, maxScore) => {
  if (maxScore <= 0) return '#94a3b8'
  const ratio = Math.min(score / maxScore, 1)
  // interpolation entre bleu (#60a5fa) et rouge (#dc2626)
  const from = [96, 165, 250]
  const to   = [220, 38, 38]
  const rgb  = from.map((c, i) => Math.round(c + (to[i] - c) * ratio))
  return `rgb(${rgb.join(',')})`
}

export default function StatistiquesPage() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod]   = useState('weekly') // 'weekly' only for now
  const [heatmap, setHeatmap] = useState([])

  useEffect(() => {
    api.get('/stats')
      .then(({ data }) => setData(data))
      .catch(console.error)
      .finally(() => setLoading(false))
    api.get('/stats/heatmap')
      .then(({ data }) => setHeatmap(Array.isArray(data) ? data : []))
      .catch(() => setHeatmap([]))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">Chargement des statistiques...</div>
  )
  if (!data) return (
    <div className="flex items-center justify-center h-64 text-red-400">Erreur de chargement</div>
  )

  const { kpis, weekly, ranking, top_categories, incidents_by_status } = data

  // Labels lisibles pour les semaines
  const weeklyLabeled = weekly.map((w, i) => ({
    ...w,
    label: i === weekly.length - 1 ? 'Cette sem.' : i === weekly.length - 2 ? 'Sem. -1' : w.label,
  }))

  const statusColors = {
    ouvert: '#ef4444', en_cours: '#f59e0b', resolu: '#34d399', ferme: '#6b7280',
  }

  return (
    <div className="space-y-6">

      {/* KPIs rapides */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Utilisateurs totaux',   value: kpis.total_utilisateurs,   color: 'text-indigo-600' },
          { label: 'Nouveaux ce mois',       value: `+${kpis.nouveaux_30j}`,   color: 'text-green-600' },
          { label: 'Points en circulation',  value: `${(kpis.points_en_circulation ?? 0).toLocaleString('fr-FR')} pts`, color: 'text-yellow-600' },
          { label: 'Taux complétion contrats', value: `${kpis.taux_completion ?? 0}%`, color: 'text-purple-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value ?? '-'}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Graphique activité hebdomadaire */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h3 className="font-semibold text-slate-700 mb-4">Activité sur 8 semaines</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={weeklyLabeled} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Bar dataKey="utilisateurs" name="Inscriptions"  fill="#6366f1" radius={[4,4,0,0]} />
            <Bar dataKey="annonces"     name="Annonces"      fill="#34d399" radius={[4,4,0,0]} />
            <Bar dataKey="evenements"   name="Événements"    fill="#f59e0b" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Points échangés */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h3 className="font-semibold text-slate-700 mb-4">Points échangés par semaine</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={weeklyLabeled} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
            <Line
              type="monotone" dataKey="points" name="Points"
              stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Carte de chaleur des activités par quartier */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h3 className="font-semibold text-slate-700 mb-1">Activité par quartier (30 derniers jours)</h3>
        <p className="text-xs text-slate-400 mb-4">
          Score = habitants + annonces + événements + incidents publiés par les habitants
        </p>
        {heatmap.length === 0 || heatmap.every((h) => !parseGeo(h.geometrie)) ? (
          <p className="text-sm text-slate-400 text-center py-6">Aucune zone de quartier définie</p>
        ) : (
          <>
            <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 360 }}>
              <MapContainer center={[48.8566, 2.3522]} zoom={12} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                {(() => {
                  const maxScore = Math.max(...heatmap.map((h) => h.score), 1)
                  return heatmap.map((h) => {
                    const coords = parseGeo(h.geometrie)
                    if (!coords) return null
                    return (
                      <Polygon key={h.id_quartier} positions={coords}
                        pathOptions={{ color: heatColor(h.score, maxScore), fillOpacity: 0.5, weight: 2 }}>
                        <LeafletTooltip sticky>
                          <strong>{h.nom}</strong><br />
                          {h.habitants} habitant(s)<br />
                          {h.annonces} annonce(s), {h.evenements} événement(s), {h.incidents} incident(s)<br />
                          Score : {h.score}
                        </LeafletTooltip>
                      </Polygon>
                    )
                  })
                })()}
              </MapContainer>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3 text-xs text-slate-400">
              <span>Faible activité</span>
              <span className="inline-block w-16 h-2 rounded-full" style={{ background: 'linear-gradient(to right, #60a5fa, #dc2626)' }} />
              <span>Forte activité</span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top catégories */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Top catégories d'annonces</h3>
          {top_categories.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Aucune donnée</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={top_categories}
                    dataKey="count"
                    nameKey="categorie"
                    cx="50%" cy="50%"
                    outerRadius={80}
                    label={({ categorie, percent }) => `${categorie} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {top_categories.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* Répartition incidents */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Répartition incidents par statut</h3>
          {incidents_by_status.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Aucun incident</p>
          ) : (
            <div className="space-y-3 mt-2">
              {incidents_by_status.map(({ statut, count }) => {
                const total = incidents_by_status.reduce((s, i) => s + i.count, 0)
                const pct   = Math.round((count / total) * 100)
                return (
                  <div key={statut}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-600 capitalize">{statut.replace('_', ' ')}</span>
                      <span className="text-slate-500">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: statusColors[statut] ?? '#94a3b8' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Classement utilisateurs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h3 className="font-semibold text-slate-700 mb-4">Classement utilisateurs par points</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="pb-3 font-medium w-10">#</th>
                <th className="pb-3 font-medium">Utilisateur</th>
                <th className="pb-3 font-medium">Rôle</th>
                <th className="pb-3 font-medium text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ranking.map((u, i) => (
                <tr key={u.id_utilisateur} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3">
                    <span className={`text-sm font-bold ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-600' : 'text-slate-300'}`}>
                      {i === 0 ? '' : i === 1 ? '' : i === 2 ? '' : `${i + 1}`}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="font-medium text-slate-700">{u.prenom} {u.nom}</span>
                  </td>
                  <td className="py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                      u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 text-right font-bold text-indigo-600">
                    {(u.points_solde ?? 0).toLocaleString('fr-FR')} pts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
