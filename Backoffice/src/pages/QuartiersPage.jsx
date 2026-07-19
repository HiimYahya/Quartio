import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import {
  MapContainer, TileLayer, Polygon, Polyline,
  CircleMarker, Tooltip, useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import booleanIntersects from '@turf/boolean-intersects'
import api from '../services/api'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626']

function DrawingLayer({ isDrawing, onComplete }) {
  const pointsRef      = useRef([])
  const historyRef     = useRef([])
  const selectedIdxRef = useRef(null)
  const [pts,         setPts]         = useState([])
  const [selectedIdx, setSelectedIdx] = useState(null)

  const setSelection = (idx) => {
    selectedIdxRef.current = idx
    setSelectedIdx(idx)
  }

  const commit = (newPts) => {
    historyRef.current = [...historyRef.current, [...pointsRef.current]]
    pointsRef.current  = newPts
    setPts([...newPts])
  }

  const undo = () => {
    if (historyRef.current.length === 0) return
    const prev = historyRef.current[historyRef.current.length - 1]
    historyRef.current = historyRef.current.slice(0, -1)
    pointsRef.current  = prev
    setPts([...prev])
  }

  const reset = () => {
    pointsRef.current  = []
    historyRef.current = []
    setPts([])
    setSelection(null)
  }

  useEffect(() => {
    if (!isDrawing) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSelection(null)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        if (selectedIdxRef.current !== null) {
          const next = pointsRef.current.filter((_, i) => i !== selectedIdxRef.current)
          commit(next)
          setSelection(null)
        } else {
          undo()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDrawing])

  useEffect(() => { if (!isDrawing) reset() }, [isDrawing])

  useMapEvents({
    click(e) {
      if (!isDrawing) return
      if (selectedIdxRef.current !== null) {
        const next = [...pointsRef.current]
        next[selectedIdxRef.current] = [e.latlng.lat, e.latlng.lng]
        commit(next)
        setSelection(null)
      } else {
        commit([...pointsRef.current, [e.latlng.lat, e.latlng.lng]])
      }
    },
    dblclick(e) {
      if (!isDrawing) return
      e.originalEvent.preventDefault()
      undo()
      const finalPts = pointsRef.current
      reset()
      if (finalPts.length < 3) return
      const ring = [
        ...finalPts.map(([lat, lng]) => [lng, lat]),
        [finalPts[0][1], finalPts[0][0]],
      ]
      onComplete(JSON.stringify({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ring] },
      }))
    },
  })

  if (!isDrawing || pts.length === 0) return null

  return (
    <>
      <Polyline positions={pts} pathOptions={{ color: '#4f46e5', weight: 2, dashArray: '6' }} />
      {pts.length >= 3 && (
        <Polygon positions={pts} pathOptions={{ color: '#4f46e5', fillOpacity: 0.15, dashArray: '6' }} />
      )}
      {pts.map((p, i) => {
        const isSelected = selectedIdx === i
        return (
          <CircleMarker key={i} center={p}
            radius={isSelected ? 9 : 5}
            pathOptions={{
              color:       isSelected ? '#f59e0b' : '#4f46e5',
              fillColor:   isSelected ? '#fbbf24' : '#fff',
              fillOpacity: 1,
              weight:      2,
            }}
            eventHandlers={{
              click(e) {
                L.DomEvent.stopPropagation(e)
                setSelection(selectedIdxRef.current === i ? null : i)
              },
            }}
          />
        )
      })}
    </>
  )
}

const parseGeo = (g) => {
  if (!g) return null
  try {
    const coords = JSON.parse(g)?.geometry?.coordinates?.[0]
    return coords ? coords.map(([lng, lat]) => [lat, lng]) : null
  } catch { return null }
}

const detectOverlap = (geoStr, quartiers, excludeId = null) => {
  try {
    const newPoly = JSON.parse(geoStr)
    return quartiers.filter((q) => {
      if (!q.geometrie) return false
      if (excludeId && q.id_quartier === excludeId) return false
      try { return booleanIntersects(newPoly, JSON.parse(q.geometrie)) }
      catch { return false }
    })
  } catch { return [] }
}

function Modal({ children }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}>
      {children}
    </div>,
    document.body,
  )
}

export default function QuartiersPage() {
  const [quartiers,    setQuartiers]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState(null)
  const [confirm,      setConfirm]      = useState(null)

  const [showForm,     setShowForm]     = useState(false)
  const [editTarget,   setEditTarget]   = useState(null)
  const [form,         setForm]         = useState({ nom: '', geometrie: '' })
  const [drawMode,     setDrawMode]     = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState(null)
  const [overlapIds,   setOverlapIds]   = useState([])
  const [overlapError, setOverlapError] = useState(null)

  const load = () => {
    api.get('/quartiers')
      .then(({ data }) => setQuartiers(data.data ?? data.quartiers ?? []))
      .catch(() => setQuartiers([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setShowForm(false); setEditTarget(null)
    setForm({ nom: '', geometrie: '' }); setDrawMode(false)
    setError(null); setOverlapIds([]); setOverlapError(null)
  }

  const openCreate = () => { resetForm(); setShowForm(true) }

  const openEdit = (q) => {
    resetForm()
    setEditTarget(q)
    setForm({ nom: q.nom, geometrie: q.geometrie ?? '' })
    setShowForm(true)
  }

  const handleDrawComplete = (geo) => {
    setDrawMode(false)
    const conflicts = detectOverlap(geo, quartiers, editTarget?.id_quartier)
    if (conflicts.length > 0) {
      setOverlapIds(conflicts.map((q) => q.id_quartier))
      setOverlapError(`Chevauchement avec : ${conflicts.map((q) => q.nom).join(', ')}. Recommencez le dessin.`)
      return
    }
    setOverlapIds([]); setOverlapError(null)
    setForm((f) => ({ ...f, geometrie: geo }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nom.trim()) return
    if (form.geometrie) {
      const conflicts = detectOverlap(form.geometrie, quartiers, editTarget?.id_quartier)
      if (conflicts.length > 0) {
        setError(`Chevauchement avec : ${conflicts.map((q) => q.nom).join(', ')}`)
        setOverlapIds(conflicts.map((q) => q.id_quartier))
        return
      }
    }
    setError(null); setSubmitting(true)
    try {
      const payload = { nom: form.nom.trim(), geometrie: form.geometrie || null }
      if (editTarget) {
        await api.put(`/quartiers/${editTarget.id_quartier}`, payload)
      } else {
        await api.post('/quartiers', payload)
      }
      resetForm(); load()
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

  return (
    <div className="flex gap-4 h-[calc(100vh-112px)] min-h-0">

      <div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto">

        {!showForm && (
          <button onClick={openCreate}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-xl transition">
            + Nouveau quartier
          </button>
        )}

        {showForm && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
            <h3 className="font-semibold text-slate-800 text-sm">
              {editTarget ? `Modifier "${editTarget.nom}"` : 'Nouveau quartier'}
            </h3>

            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nom *</label>
                <input required value={form.nom}
                  onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                  placeholder="Ex: Centre-Ville"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Zone géographique</label>

                {overlapError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2 text-xs text-red-700 space-y-1">
                    <p className="font-semibold">Chevauchement détecté</p>
                    <p>{overlapError}</p>
                  </div>
                )}

                {!drawMode ? (
                  <div className="space-y-2">
                    <button type="button"
                      onClick={() => { setDrawMode(true); setOverlapError(null); setOverlapIds([]) }}
                      className="w-full flex items-center justify-center gap-2 border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 rounded-lg py-2.5 text-sm transition">
                      {form.geometrie ? 'Redessiner la zone' : 'Dessiner la zone sur la carte'}
                    </button>
                    {form.geometrie && !overlapError && (
                      <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                        <span className="text-xs text-green-700 font-medium">Zone définie - aucun chevauchement</span>
                        <button type="button"
                          onClick={() => { setForm((f) => ({ ...f, geometrie: '' })); setOverlapIds([]) }}
                          className="text-xs text-red-400 hover:text-red-600">Effacer</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-700 space-y-1">
                      <p className="font-semibold">Mode dessin actif</p>
                      <p>{'- Clic -> poser un point'}</p>
                      <p>{'- Clic sur un point -> le sélectionner '}<span className="opacity-60">(devient orange)</span></p>
                      <p>{'- Clic sur la carte -> déplacer le point sélectionné'}</p>
                      <p>{'- Backspace -> supprimer le dernier point'}</p>
                      <p>{'- Échap -> désélectionner'}</p>
                      <p>{'- Double-clic -> fermer le polygone'}</p>
                    </div>
                    <button type="button" onClick={() => { setDrawMode(false); setOverlapIds([]) }}
                      className="w-full text-xs text-slate-500 hover:text-slate-700 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                      Annuler le dessin
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={resetForm}
                  className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50 transition">
                  Annuler
                </button>
                <button type="submit" disabled={submitting || !form.nom.trim() || drawMode}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm transition disabled:opacity-50">
                  {submitting ? 'Sauvegarde...' : editTarget ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex-1 space-y-2">
          {loading ? (
            <p className="text-center text-sm text-slate-400 py-6">Chargement...</p>
          ) : quartiers.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl border border-slate-100">
              <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Aucun quartier défini.</p>
            </div>
          ) : quartiers.map((q, i) => {
            const isConflict = overlapIds.includes(q.id_quartier)
            const isActive   = selected?.id_quartier === q.id_quartier
            return (
              <div key={q.id_quartier}
                onClick={() => setSelected(isActive ? null : q)}
                className={`bg-white rounded-xl border p-3 flex items-center gap-3 cursor-pointer transition ${
                  isConflict ? 'border-red-300 bg-red-50'
                  : isActive  ? 'border-indigo-300 bg-indigo-50'
                  : 'border-slate-100 hover:border-slate-200'
                }`}>
                <span className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: isConflict ? '#dc2626' : COLORS[i % COLORS.length] }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{q.nom}</p>
                  <p className={`text-xs ${isConflict ? 'text-red-500' : 'text-slate-400'}`}>
                    {isConflict ? 'En conflit' : q.geometrie ? 'Zone définie' : 'Aucune zone'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(q) }}
                    className="text-xs text-indigo-600 hover:underline">Modifier</button>
                  <button onClick={(e) => { e.stopPropagation(); setConfirm(q) }}
                    className="text-xs text-red-500 hover:underline">Supprimer</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className={`flex-1 rounded-2xl overflow-hidden shadow-sm border border-slate-200 ${drawMode ? 'cursor-crosshair' : ''}`}>
        <MapContainer
          center={[48.8566, 2.3522]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          doubleClickZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {quartiers.map((q, i) => {
            const coords     = parseGeo(q.geometrie)
            if (!coords) return null
            const isConflict = overlapIds.includes(q.id_quartier)
            const isActive   = selected?.id_quartier === q.id_quartier
            const isEditing  = editTarget?.id_quartier === q.id_quartier
            return (
              <Polygon key={q.id_quartier} positions={coords}
                pathOptions={{
                  color:       isConflict ? '#dc2626' : isEditing ? '#94a3b8' : COLORS[i % COLORS.length],
                  fillOpacity: isConflict ? 0.35 : isActive ? 0.3 : 0.1,
                  weight:      isConflict || isActive ? 3 : 2,
                  dashArray:   isEditing ? '6' : undefined,
                }}>
                <Tooltip sticky>
                  {q.nom}
                  {isConflict ? ' En conflit' : ''}
                  {isEditing ? ' (modification en cours)' : ''}
                </Tooltip>
              </Polygon>
            )
          })}

          <DrawingLayer isDrawing={drawMode} onComplete={handleDrawComplete} />
        </MapContainer>
      </div>

      {confirm && (
        <Modal>
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
        </Modal>
      )}
    </div>
  )
}
