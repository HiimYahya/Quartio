import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polygon, Tooltip, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import api from '../services/api'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#dc2626']

// Composant pour dessiner un polygone en cliquant sur la carte
function PolygonDrawer({ onComplete }) {
  const [points, setPoints] = useState([])

  useMapEvents({
    click(e) {
      setPoints((p) => [...p, [e.latlng.lat, e.latlng.lng]])
    },
    dblclick(e) {
      e.originalEvent.preventDefault()
      if (points.length >= 3) {
        const closed = [...points, points[0]]
        const geoJson = {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [closed.map(([lat, lng]) => [lng, lat])],
          },
        }
        onComplete(JSON.stringify(geoJson))
        setPoints([])
      }
    },
  })

  return points.length > 0 ? (
    <Polygon positions={points} pathOptions={{ color: '#4f46e5', fillOpacity: 0.2, dashArray: '5' }} />
  ) : null
}

export default function QuartiersPage() {
  const [quartiers,   setQuartiers]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [editTarget,  setEditTarget]  = useState(null)
  const [form,        setForm]        = useState({ nom: '', geometrie: '' })
  const [drawMode,    setDrawMode]    = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState(null)
  const [confirm,     setConfirm]     = useState(null)
  const [selected,    setSelected]    = useState(null)

  const load = () => {
    api.get('/quartiers')
      .then(({ data }) => setQuartiers(data.data ?? data.quartiers ?? []))
      .catch(() => setQuartiers([]))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload = { nom: form.nom, geometrie: form.geometrie || null }
      if (editTarget) {
        await api.put(`/quartiers/${editTarget.id_quartier}`, payload)
      } else {
        await api.post('/quartiers', payload)
      }
      setShowForm(false); setEditTarget(null)
      setForm({ nom: '', geometrie: '' }); setDrawMode(false)
      load()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Erreur')
    }
    setSubmitting(false)
  }

  const handleEdit = (q) => {
    setEditTarget(q)
    setForm({ nom: q.nom, geometrie: q.geometrie ?? '' })
    setShowForm(true); setDrawMode(false)
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/quartiers/${id}`)
      setQuartiers((q) => q.filter((x) => x.id_quartier !== id))
    } catch {}
    setConfirm(null)
  }

  const parseGeo = (g) => {
    if (!g) return null
    try {
      const geo = JSON.parse(g)
      const coords = geo?.geometry?.coordinates?.[0]
      return coords ? coords.map(([lng, lat]) => [lat, lng]) : null
    } catch { return null }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-400">{quartiers.length} quartier(s)</p>
        <button
          onClick={() => { setShowForm((v) => !v); setEditTarget(null); setForm({ nom: '', geometrie: '' }); setDrawMode(false) }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          {showForm ? 'Annuler' : '+ Nouveau quartier'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
          <h3 className="font-semibold text-slate-800">{editTarget ? `Modifier "${editTarget.nom}"` : 'Nouveau quartier'}</h3>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nom *</label>
            <input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} required
              placeholder="Ex: Centre-Ville"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Zone géographique */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Zone géographique</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setDrawMode((v) => !v)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${drawMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {drawMode ? '✏️ Mode dessin actif — double-clic pour finir' : '🖊 Dessiner sur la carte'}
                </button>
                {form.geometrie && (
                  <button type="button" onClick={() => setForm((f) => ({ ...f, geometrie: '' }))}
                    className="text-xs px-2 py-1.5 text-red-500 hover:text-red-700">
                    Effacer
                  </button>
                )}
              </div>
            </div>

            {drawMode ? (
              <div className="space-y-2">
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-700">
                  Cliquez sur la carte pour poser des points. Double-cliquez pour fermer le polygone.
                </div>
                <div className="h-64 rounded-xl overflow-hidden border border-slate-200">
                  <MapContainer center={[48.8566, 2.3522]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                    <PolygonDrawer onComplete={(geo) => { setForm((f) => ({ ...f, geometrie: geo })); setDrawMode(false) }} />
                  </MapContainer>
                </div>
                {form.geometrie && <p className="text-xs text-green-600">✓ Zone dessinée</p>}
              </div>
            ) : (
              <textarea value={form.geometrie}
                onChange={(e) => setForm((f) => ({ ...f, geometrie: e.target.value }))}
                rows={3} placeholder='GeoJSON (optionnel) — ex: {"type":"Feature","geometry":{"type":"Polygon","coordinates":[...]}}'
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            )}
          </div>

          <button type="button" onClick={handleSubmit} disabled={submitting || !form.nom}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition disabled:opacity-60">
            {submitting ? 'Enregistrement…' : editTarget ? 'Modifier' : 'Créer'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Liste */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Chargement…</div>
          ) : quartiers.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl border border-slate-100">
              <p className="text-slate-400">Aucun quartier défini.</p>
            </div>
          ) : quartiers.map((q, i) => (
            <div key={q.id_quartier}
              onClick={() => setSelected(selected?.id_quartier === q.id_quartier ? null : q)}
              className={`bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3 cursor-pointer transition ${selected?.id_quartier === q.id_quartier ? 'border-indigo-300 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 truncate">{q.nom}</p>
                <p className="text-xs text-slate-400">{q.geometrie ? '✓ Zone définie' : 'Aucune zone'}</p>
              </div>
              <div className="flex gap-3 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); handleEdit(q) }}
                  className="text-xs text-indigo-600 hover:underline">Modifier</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirm(q) }}
                  className="text-xs text-red-500 hover:underline">Supprimer</button>
              </div>
            </div>
          ))}
        </div>

        {/* Carte */}
        <div className="h-96 rounded-xl overflow-hidden shadow-sm border border-slate-200">
          <MapContainer center={[48.8566, 2.3522]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
            {quartiers.map((q, i) => {
              const coords = parseGeo(q.geometrie)
              if (!coords) return null
              const isSelected = selected?.id_quartier === q.id_quartier
              return (
                <Polygon key={q.id_quartier} positions={coords}
                  pathOptions={{ color: COLORS[i % COLORS.length], fillOpacity: isSelected ? 0.3 : 0.1, weight: isSelected ? 3 : 2 }}>
                  <Tooltip sticky>{q.nom}</Tooltip>
                </Polygon>
              )
            })}
          </MapContainer>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-slate-800 mb-2">Supprimer le quartier</h3>
            <p className="text-sm text-slate-500 mb-5">Supprimer <strong>{confirm.nom}</strong> ?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)}
                className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50 transition">Annuler</button>
              <button onClick={() => handleDelete(confirm.id_quartier)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm transition">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
