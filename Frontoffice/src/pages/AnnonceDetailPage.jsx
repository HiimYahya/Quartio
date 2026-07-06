import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Coins, ArrowLeft } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../store/authStore'

const TYPE_LABELS = { offre: 'Offre de service', demande: 'Demande de service' }

export default function AnnonceDetailPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)

  const [annonce,  setAnnonce]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState(false)
  const [contacting, setContacting] = useState(false)
  const [error,    setError]    = useState(null)
  const [editing,  setEditing]  = useState(false)
  const [editForm, setEditForm] = useState({ titre: '', description: '', est_payant: false, cout_points: 0 })
  const [busy,     setBusy]     = useState(false)

  useEffect(() => {
    api.get(`/annonces/${id}`)
      .then(({ data }) => setAnnonce(data))
      .catch(() => navigate('/annonces'))
      .finally(() => setLoading(false))
  }, [id])

  const isAuteur  = user?.id === annonce?.id_utilisateur_pg
  const estPayant = annonce?.est_payant && (annonce?.cout_points ?? 0) > 0

  const handleAccepter = async () => {
    setCreating(true)
    setError(null)
    try {
      const { data } = await api.post(`/annonces/${id}/contrat`)
      navigate(`/contrats/${data.id_contrat}`)
    } catch (err) {
      // Contrat déjà existant -> redirection directe
      if (err.response?.data?.id_contrat) {
        navigate(`/contrats/${err.response.data.id_contrat}`)
        return
      }
      setError(err.response?.data?.error ?? 'Erreur lors de la création du contrat')
    } finally {
      setCreating(false)
    }
  }

  const handleContacter = async () => {
    if (!annonce?.id_utilisateur_pg) return
    setContacting(true)
    setError(null)
    try {
      const { data } = await api.post('/conversations', { participants: [annonce.id_utilisateur_pg] })
      navigate(`/messages/${data._id}`)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Impossible de démarrer la conversation')
    } finally {
      setContacting(false)
    }
  }

  const startEdit = () => {
    setEditForm({
      titre: annonce.titre ?? '', description: annonce.description ?? '',
      est_payant: !!annonce.est_payant, cout_points: annonce.cout_points ?? 0,
    })
    setEditing(true); setError(null)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const { data } = await api.put(`/annonces/${id}`, {
        titre: editForm.titre,
        description: editForm.description,
        est_payant: editForm.est_payant,
        cout_points: editForm.est_payant ? parseInt(editForm.cout_points) || 0 : 0,
      })
      setAnnonce(data)
      setEditing(false)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Erreur lors de la modification')
    } finally { setBusy(false) }
  }

  const handleArchiver = async () => {
    if (!window.confirm('Archiver cette annonce ? Elle ne sera plus visible ni acceptable.')) return
    setBusy(true); setError(null)
    try {
      const { data } = await api.put(`/annonces/${id}`, { statut: 'archivee' })
      setAnnonce(data)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Erreur lors de l\'archivage')
    } finally { setBusy(false) }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement...</div>
  if (!annonce) return null

  return (
    <div className="max-w-2xl space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm text-[#2d7a5f] hover:underline inline-flex items-center gap-1.5">
        <ArrowLeft className="w-4 h-4" /> Retour aux annonces
      </button>

      {/* Carte principale */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-800">{annonce.titre}</h2>
          <span className="bg-[#1a4a3a]/10 text-[#1a4a3a] text-xs font-medium px-2.5 py-1 rounded-full capitalize shrink-0">
            {TYPE_LABELS[annonce.type] ?? annonce.type}
          </span>
        </div>

        {annonce.categorie && (
          <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">
            {annonce.categorie}
          </span>
        )}

        <p className="text-gray-600 text-sm leading-relaxed">
          {annonce.description ?? 'Aucune description.'}
        </p>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="text-sm text-gray-500">
            Publié par{' '}
            <span className="font-medium text-gray-700">
              {annonce.prenom ?? 'Un voisin'}
            </span>
          </div>
          {estPayant ? (
            <div className="flex items-center gap-1.5 bg-[#1a4a3a]/10 text-[#1a4a3a] font-bold px-3 py-1.5 rounded-xl">
              <Coins className="w-4 h-4" />
              <span>{annonce.cout_points} points</span>
            </div>
          ) : (
            <span className="bg-green-100 text-green-700 font-semibold px-3 py-1.5 rounded-xl text-sm">
              Gratuit
            </span>
          )}
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      {isAuteur ? (
        <div className="space-y-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 text-center">
            C'est votre annonce{annonce.statut !== 'active' ? ` (${annonce.statut})` : ''}. Vos voisins peuvent vous contacter pour l'accepter.
          </div>

          {editing ? (
            <form onSubmit={handleUpdate} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                <input value={editForm.titre} onChange={(e) => setEditForm((f) => ({ ...f, titre: e.target.value }))} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399] resize-none" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={editForm.est_payant} onChange={(e) => setEditForm((f) => ({ ...f, est_payant: e.target.checked }))} className="w-4 h-4 accent-[#1a4a3a]" />
                Service payant
              </label>
              {editForm.est_payant && (
                <input type="number" min={0} value={editForm.cout_points} onChange={(e) => setEditForm((f) => ({ ...f, cout_points: e.target.value }))}
                  placeholder="Coût en points"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d399]" />
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={busy}
                  className="flex-1 bg-[#1a4a3a] hover:bg-[#0f2e24] text-white py-2 rounded-lg text-sm disabled:opacity-60">
                  {busy ? '...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex gap-2">
              <button onClick={startEdit} disabled={busy}
                className="flex-1 border border-[#1a4a3a] text-[#1a4a3a] hover:bg-[#1a4a3a]/5 font-medium py-2.5 rounded-xl text-sm disabled:opacity-60">
                Modifier
              </button>
              {annonce.statut === 'active' && (
                <button onClick={handleArchiver} disabled={busy}
                  className="flex-1 border border-orange-200 text-orange-700 hover:bg-orange-50 font-medium py-2.5 rounded-xl text-sm disabled:opacity-60">
                  Archiver
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={handleAccepter}
            disabled={creating || annonce.statut !== 'active'}
            className="w-full bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {creating ? (
              'Création du contrat...'
            ) : annonce.statut !== 'active' ? (
              'Annonce non disponible'
            ) : estPayant ? (
              <>Accepter ce service ({annonce.cout_points} pts)</>
            ) : (
              'Accepter ce service (gratuit)'
            )}
          </button>

          {estPayant && annonce.statut === 'active' && (
            <p className="text-xs text-gray-400 text-center">
              {annonce.cout_points} points seront débités à la finalisation, une fois les deux parties ayant signé.
            </p>
          )}

          <button
            onClick={handleContacter}
            disabled={contacting}
            className="w-full border border-[#1a4a3a] text-[#1a4a3a] hover:bg-[#1a4a3a]/5 font-medium py-2.5 rounded-xl transition-colors text-sm disabled:opacity-60"
          >
            {contacting ? 'Ouverture...' : 'Contacter le voisin'}
          </button>

          {annonce.id_utilisateur_pg && (
            <button
              onClick={() => navigate(`/profil/${annonce.id_utilisateur_pg}`)}
              className="w-full text-sm text-[#2d7a5f] hover:underline text-center"
            >
              Voir le profil du voisin
            </button>
          )}
        </div>
      )}
    </div>
  )
}
