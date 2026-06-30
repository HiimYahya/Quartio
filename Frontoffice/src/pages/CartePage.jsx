import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Link } from 'react-router-dom'
import { X, Megaphone, CalendarDays, ArrowRight } from 'lucide-react'
import api from '../services/api'

// Fix icônes Leaflet (bug connu avec bundlers)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Icônes colorées custom
const makeIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="
    width:28px;height:28px;border-radius:50% 50% 50% 0;
    background:${color};border:3px solid white;
    transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.3)
  "></div>`,
  iconSize:   [28, 28],
  iconAnchor: [14, 28],
  popupAnchor:[0, -30],
})

const ANNONCE_ICON  = makeIcon('#2563eb')
const EVENEMENT_ICON = makeIcon('#7c3aed')
const QUARTIER_ICON  = makeIcon('#1a4a3a')

// Couleurs des zones de quartier
const ZONE_COLORS = ['#1a4a3a', '#2d7a5f', '#34d399', '#059669', '#0d9488']

// Paris par défaut si aucun quartier
const PARIS_CENTER = [48.8566, 2.3522]

// Fallback : quartiers fictifs autour de Paris pour démo visuelle
const DEMO_QUARTIERS = [
  {
    id_quartier: 1, nom: 'Centre-Ville',
    center: [48.8606, 2.3376],
    geometrie: JSON.stringify({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[2.32,48.855],[2.36,48.855],[2.36,48.870],[2.32,48.870],[2.32,48.855]]] }
    }),
  },
  {
    id_quartier: 2, nom: 'Belleville',
    center: [48.8702, 2.3814],
    geometrie: JSON.stringify({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[2.365,48.860],[2.400,48.860],[2.400,48.882],[2.365,48.882],[2.365,48.860]]] }
    }),
  },
  {
    id_quartier: 3, nom: 'Montparnasse',
    center: [48.8420, 2.3218],
    geometrie: JSON.stringify({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[2.305,48.832],[2.340,48.832],[2.340,48.852],[2.305,48.852],[2.305,48.832]]] }
    }),
  },
  {
    id_quartier: 4, nom: 'République',
    center: [48.8674, 2.3631],
    geometrie: JSON.stringify({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[2.352,48.858],[2.378,48.858],[2.378,48.878],[2.352,48.878],[2.352,48.858]]] }
    }),
  },
]

function FlyTo({ center }) {
  const map = useMap()
  useEffect(() => { if (center) map.flyTo(center, 15, { duration: 0.8 }) }, [center])
  return null
}

export default function CartePage() {
  const [quartiers, setQuartiers]   = useState([])
  const [annonces, setAnnonces]     = useState([])
  const [evenements, setEvenements] = useState([])
  const [loading, setLoading]       = useState(true)
  const [usingDemo, setUsingDemo]   = useState(false)

  const [activeLayer, setActiveLayer] = useState('all') // 'all' | 'annonces' | 'evenements'
  const [selected, setSelected]       = useState(null)  // quartier sélectionné
  const [flyTo, setFlyTo]             = useState(null)

  useEffect(() => {
    const load = async () => {
      const [q, a, e] = await Promise.allSettled([
        api.get('/quartiers'),
        api.get('/annonces'),
        api.get('/evenements'),
      ])

      const qData = q.value?.data?.data ?? q.value?.data?.quartiers ?? []
      if (qData.length === 0) {
        setQuartiers(DEMO_QUARTIERS)
        setUsingDemo(true)
      } else {
        setQuartiers(qData)
      }

      setAnnonces(a.value?.data?.data ?? a.value?.data?.annonces ?? [])
      setEvenements(e.value?.data?.data ?? e.value?.data?.evenements ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // Centre calculé depuis la liste des quartiers
  const mapCenter = (() => {
    if (quartiers.length === 0) return PARIS_CENTER
    const q = quartiers[0]
    if (q.center) return q.center
    if (q.geometrie) {
      try {
        const geo = JSON.parse(q.geometrie)
        const coords = geo?.geometry?.coordinates?.[0]
        if (coords?.length) {
          const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length
          const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length
          return [lat, lng]
        }
      } catch {}
    }
    return PARIS_CENTER
  })()

  // Centroïde d'un quartier (pour les marqueurs)
  const getCentroid = (q) => {
    if (q.center) return q.center
    if (q.geometrie) {
      try {
        const geo = JSON.parse(q.geometrie)
        const coords = geo?.geometry?.coordinates?.[0]
        if (coords?.length) {
          const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length
          const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length
          return [lat, lng]
        }
      } catch {}
    }
    return null
  }

  const handleSelectQuartier = (q) => {
    setSelected(q)
    const c = getCentroid(q)
    if (c) setFlyTo(c)
  }

  const quartierAnnonces  = annonces.filter((a) => a.id_quartier === selected?.id_quartier)
  const quartierEvenements = evenements.filter((e) => e.id_quartier === selected?.id_quartier)

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400">Chargement de la carte...</div>
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-112px)]">

      {/* Panneau gauche */}
      <div className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto">

        {usingDemo && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-3 py-2 text-xs">
            Données de démonstration - PostgreSQL non disponible en prod.
          </div>
        )}

        {/* Filtres de couches */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Afficher</p>
          <div className="flex flex-col gap-1">
            {[
              { key: 'all',        label: 'Tout' },
              { key: 'annonces',   label: 'Annonces' },
              { key: 'evenements', label: 'Événements' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveLayer(key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  activeLayer === key
                    ? 'bg-[#1a4a3a] text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Liste des quartiers */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quartiers</p>
          <div className="space-y-1">
            {quartiers.map((q, i) => (
              <button
                key={q.id_quartier}
                onClick={() => handleSelectQuartier(q)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                  selected?.id_quartier === q.id_quartier
                    ? 'bg-[#1a4a3a]/10 text-[#1a4a3a] font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: ZONE_COLORS[i % ZONE_COLORS.length] }}
                />
                {q.nom}
              </button>
            ))}
          </div>
        </div>

        {/* Détail quartier sélectionné */}
        {selected && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm">{selected.nom}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xs">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">
                Annonces ({annonces.length > 0 ? quartierAnnonces.length : '-'})
              </p>
              {quartierAnnonces.slice(0, 3).map((a) => (
                <Link
                  key={a._id ?? a.id}
                  to={`/annonces/${a._id ?? a.id}`}
                  className="flex items-center gap-2 py-1.5 text-xs text-gray-700 hover:text-[#1a4a3a] border-b border-gray-50 last:border-0"
                >
                  <Megaphone className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">{a.titre}</span>
                </Link>
              ))}
              {quartierAnnonces.length === 0 && (
                <p className="text-xs text-gray-400 italic">Aucune annonce</p>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">
                Événements ({evenements.length > 0 ? quartierEvenements.length : '-'})
              </p>
              {quartierEvenements.slice(0, 3).map((e) => (
                <Link
                  key={e._id ?? e.id}
                  to={`/evenements/${e._id ?? e.id}`}
                  className="flex items-center gap-2 py-1.5 text-xs text-gray-700 hover:text-[#1a4a3a] border-b border-gray-50 last:border-0"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span className="truncate">{e.titre}</span>
                </Link>
              ))}
              {quartierEvenements.length === 0 && (
                <p className="text-xs text-gray-400 italic">Aucun événement</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Carte */}
      <div className="flex-1 rounded-2xl overflow-hidden shadow-sm border border-gray-200">
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {flyTo && <FlyTo center={flyTo} />}

          {/* Zones des quartiers */}
          {quartiers.map((q, i) => {
            if (!q.geometrie) return null
            let geo
            try { geo = JSON.parse(q.geometrie) } catch { return null }
            return (
              <GeoJSON
                key={q.id_quartier}
                data={geo}
                style={{
                  color:       ZONE_COLORS[i % ZONE_COLORS.length],
                  weight:      2,
                  opacity:     0.8,
                  fillColor:   ZONE_COLORS[i % ZONE_COLORS.length],
                  fillOpacity: selected?.id_quartier === q.id_quartier ? 0.25 : 0.1,
                }}
                eventHandlers={{ click: () => handleSelectQuartier(q) }}
              />
            )
          })}

          {/* Marqueurs des quartiers */}
          {quartiers.map((q) => {
            const c = getCentroid(q)
            if (!c) return null
            return (
              <Marker key={`q-${q.id_quartier}`} position={c} icon={QUARTIER_ICON}>
                <Popup>
                  <div className="text-sm font-semibold">{q.nom}</div>
                </Popup>
              </Marker>
            )
          })}

          {/* Marqueurs annonces */}
          {(activeLayer === 'all' || activeLayer === 'annonces') &&
            annonces.map((a, idx) => {
              const q = quartiers.find((q) => q.id_quartier === a.id_quartier)
              const c = q ? getCentroid(q) : null
              if (!c) return null
              const offset = [(idx % 5 - 2) * 0.002, (Math.floor(idx / 5) % 3 - 1) * 0.002]
              return (
                <Marker
                  key={`a-${a._id ?? a.id}`}
                  position={[c[0] + offset[0], c[1] + offset[1]]}
                  icon={ANNONCE_ICON}
                >
                  <Popup>
                    <div className="space-y-1 text-sm min-w-[160px]">
                      <p className="font-semibold text-gray-800">{a.titre}</p>
                      {a.description && <p className="text-gray-500 text-xs line-clamp-2">{a.description}</p>}
                      <div className="flex items-center justify-between pt-1">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${a.est_payant ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {a.est_payant ? `${a.cout_points} pts` : 'Gratuit'}
                        </span>
                        <Link to={`/annonces/${a._id ?? a.id}`} className="text-xs text-[#2d7a5f] hover:underline inline-flex items-center gap-1">
                          Voir <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}

          {/* Marqueurs événements */}
          {(activeLayer === 'all' || activeLayer === 'evenements') &&
            evenements.map((ev, idx) => {
              const q = quartiers.find((q) => q.id_quartier === ev.id_quartier)
              const c = q ? getCentroid(q) : null
              if (!c) return null
              const offset = [(idx % 5 - 2) * 0.002, (Math.floor(idx / 5) % 3) * 0.002]
              return (
                <Marker
                  key={`e-${ev._id ?? ev.id}`}
                  position={[c[0] + offset[0], c[1] + offset[1]]}
                  icon={EVENEMENT_ICON}
                >
                  <Popup>
                    <div className="space-y-1 text-sm min-w-[160px]">
                      <p className="font-semibold text-gray-800">{ev.titre}</p>
                      {ev.lieu && <p className="text-xs text-gray-500">{ev.lieu}</p>}
                      {ev.date_debut && (
                        <p className="text-xs text-gray-500">
                          {new Date(ev.date_debut).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                      <Link to={`/evenements/${ev._id ?? ev.id}`} className="text-xs text-[#2d7a5f] hover:underline inline-flex items-center gap-1">
                        Voir <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
        </MapContainer>
      </div>
    </div>
  )
}
