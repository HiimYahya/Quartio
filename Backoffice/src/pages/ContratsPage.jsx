import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import api from '../services/api'

const STATUT_LABELS = { en_attente: 'En attente', signe: 'Signé', annule: 'Annulé', termine: 'Terminé', litige: 'En litige' }
const STATUT_COLORS = {
  en_attente: 'bg-yellow-100 text-yellow-700',
  signe:      'bg-green-100 text-green-700',
  annule:     'bg-red-100 text-red-600',
  termine:    'bg-slate-100 text-slate-500',
  litige:     'bg-orange-100 text-orange-700',
}

export default function ContratsPage() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)

  const load = async () => {
    // ?tous=true : tous les contrats de la plateforme (l'API pagine à 20 par
    // défaut et ne renvoie sinon que les contrats de l'admin lui-même)
    try {
      const all = []
      let page = 1
      let pages = 1
      do {
        const { data } = await api.get(`/contrats?tous=true&limit=100&page=${page}`)
        all.push(...(data.data ?? data.contrats ?? []))
        pages = data.pagination?.pages ?? 1
        page += 1
      } while (page <= pages)
      setItems(all)
    } catch {
      setItems([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleStatut = async (id, statut) => {
    try {
      await api.put(`/contrats/${id}/statut`, { statut })
      setItems((v) => v.map((x) => x.id_contrat === id ? { ...x, statut } : x))
    } catch (err) {
      alert(err.response?.data?.error ?? 'Changement de statut impossible')
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/contrats/${id}`)
      setItems((v) => v.filter((x) => x.id_contrat !== id))
    } catch {}
    setConfirm(null)
  }

  const handleDocument = async (id) => {
    try {
      const { data } = await api.get(`/contrats/${id}/document`)
      if (data.pdf_url) {
        window.open(data.pdf_url, '_blank')
      } else if (data.pdf_base64) {
        const bytes = atob(data.pdf_base64)
        const buffer = new Uint8Array(bytes.length)
        for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i)
        const blob = new Blob([buffer], { type: 'application/pdf' })
        window.open(URL.createObjectURL(blob), '_blank')
      } else {
        alert('Aucun document archivé pour ce contrat.')
      }
    } catch {
      alert('Aucun document archivé pour ce contrat.')
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{items.length} contrat(s)</p>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">Aucun contrat.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Contrat', 'Vendeur', 'Acheteur', 'Points', 'Création', 'Signature', 'Statut', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((c) => (
                <tr key={c.id_contrat} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-medium text-slate-800">#{c.id_contrat}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {[c.vendeur_prenom, c.vendeur_nom].filter(Boolean).join(' ') || (c.id_vendeur ? `#${c.id_vendeur}` : '-')}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {[c.acheteur_prenom, c.acheteur_nom].filter(Boolean).join(' ') || (c.id_acheteur ? `#${c.id_acheteur}` : '-')}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.points_echanges > 0 ? `${c.points_echanges} pts` : 'Gratuit'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {c.date_creation ? new Date(c.date_creation).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {c.date_signature ? new Date(c.date_signature).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {/* 'termine' et 'litige' sont posés par le système ; le backend les refuse à la main */}
                    <select value={c.statut ?? 'en_attente'} onChange={(e) => handleStatut(c.id_contrat, e.target.value)}
                      disabled={c.statut === 'termine' || c.statut === 'litige'}
                      title={c.statut === 'termine' || c.statut === 'litige' ? 'Statut géré par le système (signatures / résolution de litige)' : undefined}
                      className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed ${STATUT_COLORS[c.statut] ?? 'bg-slate-100'}`}>
                      {Object.entries(STATUT_LABELS).map(([v, l]) => (
                        <option key={v} value={v} disabled={v === 'termine' || v === 'litige'}>{l}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {(c.statut === 'signe' || c.statut === 'termine') && (
                        <button onClick={() => handleDocument(c.id_contrat)}
                          className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline">
                          Document
                        </button>
                      )}
                      <button onClick={() => setConfirm({ id: c.id_contrat })}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline">
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-slate-800 mb-2">Confirmer la suppression</h3>
            <p className="text-sm text-slate-500 mb-5">
              Supprimer le contrat <strong>#{confirm.id}</strong> ? Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)}
                className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50 transition">
                Annuler
              </button>
              <button onClick={() => handleDelete(confirm.id)}
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
