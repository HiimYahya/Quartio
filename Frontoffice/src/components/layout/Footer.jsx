import { useState } from 'react'
import { AlertTriangle, X, Send } from 'lucide-react'
import api from '../../services/api'
import { toast } from '../../store/toastStore'

const TYPES = [
  { value: 'voirie', label: 'Voirie' },
  { value: 'eclairage', label: 'Éclairage' },
  { value: 'proprete', label: 'Propreté' },
  { value: 'nuisance', label: 'Nuisance' },
  { value: 'mobilier', label: 'Mobilier urbain' },
  { value: 'eau', label: 'Eau' },
  { value: 'incivilite', label: 'Incivilité' },
  { value: 'autre', label: 'Autre' },
]

const EMPTY = { titre: '', description: '', type: 'voirie', priorite: 'normale' }

export default function Footer() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)

  const close = () => { if (!loading) { setOpen(false); setForm(EMPTY) } }
  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.titre.trim()) return toast.error('Le titre est obligatoire.')
    setLoading(true)
    try {
      await api.post('/incidents', {
        titre: form.titre.trim(),
        description: form.description.trim(),
        type: form.type,
        priorite: form.priorite,
      })
      toast.success('Signalement envoyé. Merci !')
      setOpen(false)
      setForm(EMPTY)
    } catch (err) {
      toast.error(err.response?.data?.error ?? "Impossible d'envoyer le signalement.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <footer className="shrink-0 border-t border-gray-200 bg-white">
        <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-2.5 flex items-center justify-between gap-4">
          <span className="text-xs text-gray-400">© {new Date().getFullYear()} Quartio</span>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1a4a3a] hover:text-[#0f2e24] transition-colors">
            <AlertTriangle className="w-4 h-4" />
            Signaler un problème
          </button>
        </div>
      </footer>

      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40" onClick={close}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Signaler un problème
              </h3>
              <button onClick={close} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={submit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                <input name="titre" value={form.titre} onChange={change} required maxLength={200}
                  placeholder="Ex : Lampadaire cassé rue des Lilas"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select name="type" value={form.type} onChange={change}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]">
                    {TYPES.map((tp) => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
                  <select name="priorite" value={form.priorite} onChange={change}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]">
                    <option value="basse">Basse</option>
                    <option value="normale">Normale</option>
                    <option value="haute">Haute</option>
                    <option value="critique">Critique</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea name="description" value={form.description} onChange={change} rows={3}
                  placeholder="Décrivez le problème et sa localisation…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399] resize-none" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={close} disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#1a4a3a] hover:bg-[#0f2e24] rounded-lg transition-colors disabled:opacity-60">
                  <Send className="w-4 h-4" />
                  {loading ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
