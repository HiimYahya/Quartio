import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import api from '../services/api'

const PRIORITE_COLORS = {
  basse: 'bg-blue-100 text-blue-700',
  normale: 'bg-yellow-100 text-yellow-700',
  haute: 'bg-orange-100 text-orange-700',
  critique: 'bg-red-100 text-red-700',
}

export default function IncidentsPage() {
  const { t } = useTranslation()
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ titre: '', description: '', type: '', priorite: 'normale' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/incidents')
      setIncidents(data.data ?? data.incidents ?? data ?? [])
    } catch { setIncidents([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api.post('/incidents', {
        titre: form.titre,
        description: form.description || undefined,
        type: form.type || undefined,
        priorite: form.priorite,
      })
      setShowForm(false)
      setForm({ titre: '', description: '', type: '', priorite: 'normale' })
      load()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Erreur lors du signalement')
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">{t('incidents.count', { count: incidents.length })}</p>
        <button onClick={() => setShowForm((v) => !v)}
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          {showForm ? t('incidents.cancel') : t('incidents.report')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-red-100 p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">{t('incidents.report')}</h3>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('incidents.incTitle')} *</label>
            <input value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))} required
              placeholder={t('incidents.placeholderTitle')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('incidents.description')}</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3}
              placeholder={t('incidents.placeholderDesc')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('incidents.type')}</label>
              <input value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                placeholder={t('incidents.placeholderType')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('incidents.priority')}</label>
              <select value={form.priorite} onChange={(e) => setForm((f) => ({ ...f, priorite: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300">
                {['basse','normale','haute','critique'].map((p) => (
                  <option key={p} value={p}>{t(`incidents.${p}`)}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" disabled={submitting}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-60">
            {submitting ? t('incidents.sending') : t('incidents.send')}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : incidents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <AlertTriangle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t('incidents.noIncidents')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => (
            <div key={inc.id ?? inc._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h4 className="font-semibold text-gray-800">{inc.titre}</h4>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${PRIORITE_COLORS[inc.priorite] ?? 'bg-gray-100 text-gray-600'}`}>
                  {t(`incidents.${inc.priorite}`) ?? inc.priorite}
                </span>
              </div>
              {inc.description && <p className="text-sm text-gray-500 line-clamp-2">{inc.description}</p>}
              <p className="text-xs text-gray-400 mt-2">
                {t('incidents.reportedOn', { date: inc.created_at ? new Date(inc.created_at).toLocaleDateString('fr-FR') : '-' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
