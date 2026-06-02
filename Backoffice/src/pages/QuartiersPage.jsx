import { useEffect, useRef, useState } from 'react'
import {
  MapContainer, TileLayer, Polygon, Polyline,
  CircleMarker, Tooltip, useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import api from '../services/api'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626']

// ─── Couche de dessin ────────────────────────────────────────────────────────
// Montée à l'intérieur du MapContainer. Quand isDrawing=true, chaque clic sur
// la carte ajoute un point. Le double-clic ferme le polygone.
//
// Pourquoi un ref ET un state ?
//   - Le ref (pointsRef) est mis à jour de façon SYNCHRONE à chaque clic.
//     Cela garantit que lors du dblclick, on a exactement les bons points.
//   - Le state (renderPoints) sert uniquement à déclencher le re-render pour
//     afficher les CircleMarkers et la Polyline en temps réel.
//
// Pourquoi slice(0, -2) dans le dblclick ?
//   Un double-clic envoie les événements dans cet ordre :
//     click → click → dblclick
//   Les 2 "click" ajoutent chacun un point au même endroit avant que dblclick
//   ne se déclenche. On les retire avec slice(0, -2) avant de créer le GeoJSON.
function DrawingLayer({ isDrawing, onComplete }) {
  const pointsRef   = useRef([])
  const [pts, setPts] = useState([])

  const addPoint = (latlng) => {
    const p = [latlng.lat, latlng.lng]
    pointsRef.current = [...pointsRef.current, p]
    setPts([...pointsRef.current])
  }

  const reset = () => {
    pointsRef.current = []
    setPts([])
  }

  useMapEvents({
    click(e) {
      if (!isDrawing) return
      addPoint(e.latlng)
    },
    dblclick(e) {
      if (!isDrawing) return
      // preventDefault bloque le comportement Leaflet natif (zoom-in sur dblclick)
      // mais doubleClickZoom={false} sur le MapContainer est la vraie protection
      e.originalEvent.preventDefault()

      // À cet instant, pointsRef.current contient les 2 points parasites ajoutés
      // par les 2 "click" qui ont précédé ce dblclick — on les supprime
      const cleaned = pointsRef.current.slice(0, -2)

      reset()

      if (cleaned.length < 3) return  // pas assez de points pour un polygone valide

      // Conversion Leaflet [lat, lng] → GeoJSON [lng, lat] + fermeture de l'anneau
      const ring = [...cleaned.map(([lat, lng]) => [lng, lat]), [cleaned[0][1], cleaned[0][0]]]
      onComplete(JSON.stringify({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ring] },
      }))
    },
  })

  if (!isDrawing || pts.length === 0) return null

  return (
    <>
      {/* Ligne reliant les points placés */}
      <Polyline positions={pts} pathOptions={{ color: '#4f46e5', weight: 2, dashArray: '6' }} />

      {/* Aperçu du polygone dès 3 points */}
      {pts.length >= 3 && (
        <Polygon positions={pts} pathOptions={{ color: '#4f46e5', fillOpacity: 0.15, dashArray: '6' }} />
      )}

      {/* Marqueur sur chaque point cliqué */}
      {pts.map((p, i) => (
        <CircleMarker key={i} center={p} radius={5}
          pathOptions={{ color: '#4f46e5', fillColor: '#fff', fillOpacity: 1, weight: 2 }} />
      ))}
    </>
  )
}

// ─── Utilitaire : GeoJSON string → positions Leaflet [[lat, lng], ...] ───────
const parseGeo = (g) => {
  if (!g) return null
  try {
    const geo    = JSON.parse(g)
    const coords = geo?.geometry?.coordinates?.[0]
    return coords ? coords.map(([lng, lat]) => [lat, lng]) : null
  } catch { return null }
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function QuartiersPage() {
  const [quartiers,  setQuartiers]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState(null)
  const [confirm,    setConfirm]    = useState(null)

  // Formulaire (create + edit)
  const [showForm,   setShowForm]   = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form,       setForm]       = useState({ nom: '', geometrie: '' })
  const [drawMode,   setDrawMode]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState(null)

  const load = () => {
    api.get('/quartiers')
      .then(({ data }) => setQuartiers(data.data ?? data.quartiers ?? []))
      .catch(() => setQuartiers([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditTarget(null)
    setForm({ nom: '', geometrie: '' })
    setDrawMode(false)
    setError(null)
    setShowForm(true)
  }

  const openEdit = (q) => {
    setEditTarget(q)
    setForm({ nom: q.nom, geometrie: q.geometrie ?? '' })
    setDrawMode(false)
    setError(null)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nom.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      const payload = { nom: form.nom.trim(), geometrie: form.geometrie || null }
      if (editTarget) {
        await api.put(`/quartiers/${editTarget.id_quartier}`, payload)
      } else {
        await api.post('/quartiers', payload)
      }
      setShowForm(false)
      setEditTarget(null)
      setForm({ nom: '', geometrie: '' })
      setDrawMode(false)
      load()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Erreur lors de la sauvegarde')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/quartiers/${id}`)
      setQuartiers((q) => q.filter((x) => x.id_quartier !== id))
      if (selected?.id_quartier === id) setSelected(null)
    } catch {}
    setConfirm(null)
  }

  // Quand le dessin est terminé, on stocke le GeoJSON et on sort du mode dessin
  const handleDrawComplete = (geo) => {
    setForm((f) => ({ ...f, geometrie: geo }))
    setDrawMode(false)
  }

  const cancelDraw = () => {
    setDrawMode(false)
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-112px)] min-h-0">

      {/* ── Colonne gauche : liste + formulaire ─────────────────────────── */}
      <div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto">

        {/* Bouton nouveau quartier */}
        {!showForm && (
          <button onClick={openCreate}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-xl transition">
            + Nouveau quartier
          </button>
        )}

        {/* Formulaire create / edit */}
        {showForm && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
            <h3 className="font-semibold text-slate-800 text-sm">
              {editTarget ? `Modifier "${editTarget.nom}"` : 'Nouveau quartier'}
            </h3>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nom *</label>
                <input required value={form.nom}
                  onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                  placeholder="Ex: Centre-Ville"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              {/* Zone dessin */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Zone géographique</label>

                {!drawMode ? (
                  <div className="space-y-2">
                    <button type="button" onClick={() => setDrawMode(true)}
                      className="w-full flex items-center justify-center gap-2 border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 rounded-lg py-2.5 text-sm transition">
                      <span>✏️</span>
                      {form.geometrie ? 'Redessiner la zone sur la carte' : 'Dessiner la zone sur la carte'}
                    </button>
                    {form.geometrie && (
                      <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                        <span className="text-xs text-green-700 font-medium">✓ Zone définie</span>
                        <button type="button" onClick={() => setForm((f) => ({ ...f, geometrie: '' }))}
                          className="text-xs text-red-400 hover:text-red-600">Effacer</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-700 space-y-1">
                      <p className="font-semibold">Mode dessin actif</p>
                      <p>• Cliquez sur la carte pour placer des points</p>
                      <p>• Double-cliquez pour fermer le polygone</p>
                    </div>
                    <button type="button" onClick={cancelDraw}
                      className="w-full text-xs text-slate-500 hover:text-slate-700 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                      Annuler le dessin
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button"
                  onClick={() => { setShowForm(false); setDrawMode(false); setError(null) }}
                  className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50 transition">
                  Annuler
                </button>
                <button type="submit" disabled={submitting || !form.nom.trim() || drawMode}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm transition disabled:opacity-50">
                  {submitting ? 'Sauvegarde…' : editTarget ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Liste des quartiers */}
        <div className="flex-1 space-y-2">
          {loading ? (
            <p className="text-center text-sm text-slate-400 py-6">Chargement…</p>
          ) : quartiers.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl border border-slate-100">
              <p className="text-slate-400 text-sm">Aucun quartier défini.</p>
            </div>
          ) : quartiers.map((q, i) => (
            <div key={q.id_quartier}
              onClick={() => setSelected(selected?.id_quartier === q.id_quartier ? null : q)}
              className={`bg-white rounded-xl border p-3 flex items-center gap-3 cursor-pointer transition ${
                selected?.id_quartier === q.id_quartier
                  ? 'border-indigo-300 bg-indigo-50'
                  : 'border-slate-100 hover:border-slate-200'
              }`}>
              <span className="w-3 h-3 rounded-full shrink-0"
                style={{ background: COLORS[i % COLORS.length] }} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 text-sm truncate">{q.nom}</p>
                <p className="text-xs text-slate-400">{q.geometrie ? '✓ Zone définie' : 'Aucune zone'}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); openEdit(q) }}
                  className="text-xs text-indigo-600 hover:underline">Modifier</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirm(q) }}
                  className="text-xs text-red-500 hover:underline">Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Carte principale ─────────────────────────────────────────────── */}
      {/* Une seule MapContainer qui sert à la fois à visualiser les quartiers
          existants ET à dessiner de nouveaux polygones. Le curseur passe en
          crosshair quand le mode dessin est actif. */}
      <div className={`flex-1 rounded-2xl overflow-hidden shadow-sm border border-slate-200 ${drawMode ? 'cursor-crosshair' : ''}`}>
        <MapContainer
          center={[48.8566, 2.3522]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          doubleClickZoom={false}   // désactivé pour ne pas interférer avec la fermeture du polygone
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Polygones des quartiers existants */}
          {quartiers.map((q, i) => {
            const coords = parseGeo(q.geometrie)
            if (!coords) return null
            const isSelected = selected?.id_quartier === q.id_quartier
            return (
              <Polygon key={q.id_quartier} positions={coords}
                pathOptions={{
                  color:       COLORS[i % COLORS.length],
                  fillOpacity: isSelected ? 0.3 : 0.1,
                  weight:      isSelected ? 3 : 2,
                }}>
                <Tooltip sticky>{q.nom}</Tooltip>
              </Polygon>
            )
          })}

          {/* Couche de dessin interactive — active uniquement en mode dessin */}
          <DrawingLayer isDrawing={drawMode} onComplete={handleDrawComplete} />
        </MapContainer>
      </div>

      {/* ── Modal suppression ─────────────────────────────────────────────── */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-slate-800 mb-2">Supprimer le quartier</h3>
            <p className="text-sm text-slate-500 mb-5">
              Supprimer <strong>{confirm.nom}</strong> ? Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)}
                className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50 transition">
                Annuler
              </button>
              <button onClick={() => handleDelete(confirm.id_quartier)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm transition">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
