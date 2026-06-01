import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

const STATUS_LABELS = { en_attente: 'En attente', signe: 'Signé', annule: 'Annulé', termine: 'Terminé' }
const STATUS_COLORS = {
  en_attente: 'bg-yellow-100 text-yellow-700',
  signe:      'bg-green-100 text-green-700',
  annule:     'bg-red-100 text-red-700',
  termine:    'bg-gray-100 text-gray-600',
}

export default function ContratsPage() {
  const [contrats, setContrats] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    api.get('/contrats')
      .then(({ data }) => setContrats(data.data ?? data.contrats ?? []))
      .catch(() => setContrats([]))
      .finally(() => setLoading(false))
  }, [])

  const enAttente = contrats.filter((c) => c.statut === 'en_attente')
  const autres    = contrats.filter((c) => c.statut !== 'en_attente')

  return (
    <div className="space-y-5">
      <p className="text-gray-500 text-sm">{contrats.length} contrat(s)</p>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement…</div>
      ) : contrats.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-gray-500">Aucun contrat pour le moment.</p>
          <p className="text-sm text-gray-400 mt-1">
            Les contrats sont générés automatiquement lors d'échanges de services payants.
          </p>
        </div>
      ) : (
        <>
          {/* Contrats à signer en priorité */}
          {enAttente.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-yellow-700 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                À signer ({enAttente.length})
              </h3>
              <div className="space-y-2">
                {enAttente.map((c) => (
                  <ContratCard key={c.id_contrat} c={c} />
                ))}
              </div>
            </div>
          )}

          {/* Autres contrats */}
          {autres.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-2">Historique</h3>
              <div className="space-y-2">
                {autres.map((c) => (
                  <ContratCard key={c.id_contrat} c={c} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ContratCard({ c }) {
  const STATUS_LABELS = { en_attente: 'En attente', signe: 'Signé', annule: 'Annulé', termine: 'Terminé' }
  const STATUS_COLORS = {
    en_attente: 'bg-yellow-100 text-yellow-700',
    signe:      'bg-green-100 text-green-700',
    annule:     'bg-red-100 text-red-700',
    termine:    'bg-gray-100 text-gray-600',
  }

  return (
    <Link
      to={`/contrats/${c.id_contrat}`}
      className="flex items-center gap-4 bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
        c.statut === 'en_attente' ? 'bg-yellow-50' : 'bg-[#1a4a3a]/10'
      }`}>
        {c.statut === 'signe' ? '✅' : '📄'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800">Contrat #{c.id_contrat}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-xs text-gray-400">
            {c.date_creation ? new Date(c.date_creation).toLocaleDateString('fr-FR') : '—'}
          </p>
          {c.points_echanges > 0 && (
            <span className="text-xs text-[#2d7a5f] font-medium">{c.points_echanges} pts</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[c.statut] ?? 'bg-gray-100 text-gray-600'}`}>
          {STATUS_LABELS[c.statut] ?? c.statut}
        </span>
        {c.statut === 'en_attente' && (
          <span className="text-xs font-semibold text-[#1a4a3a] bg-[#1a4a3a]/10 px-2.5 py-1 rounded-full">
            Signer →
          </span>
        )}
      </div>
    </Link>
  )
}
