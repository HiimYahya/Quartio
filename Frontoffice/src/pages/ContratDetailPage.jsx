import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import { PDFDocument, rgb } from 'pdf-lib'
import { CheckCircle2, Info, Upload, X, ArrowRight, ArrowLeft, Check, Ban, AlertTriangle } from 'lucide-react'
import api from '../services/api'
import useAuthStore from '../store/authStore'

const STATUS_LABELS = {
  en_attente: 'En attente de signature',
  signe:      'Signature(s) reçue(s)',
  annule:     'Annulé',
  termine:    'Finalisé',
  litige:     'En litige',
}
const STATUS_COLORS = {
  en_attente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  signe:      'bg-blue-100 text-blue-700 border-blue-200',
  annule:     'bg-red-100 text-red-700 border-red-200',
  termine:    'bg-green-100 text-green-700 border-green-200',
  litige:     'bg-orange-100 text-orange-700 border-orange-200',
}

function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

// Coordonnées (x, y) du coin bas-gauche de la zone de signature selon la
// position choisie et la taille de la page / de l'image de signature.
function signaturePosition(position, pageWidth, pageHeight, sigDims, offset) {
  switch (position) {
    case 'bottom-left': return { x: 40, y: 40 + offset }
    case 'top-right':   return { x: pageWidth - sigDims.width - 40, y: pageHeight - sigDims.height - 40 }
    case 'top-left':    return { x: 40, y: pageHeight - sigDims.height - 40 }
    default:            return { x: pageWidth - sigDims.width - 40, y: 40 + offset } // bottom-right
  }
}

const SIGNATURE_POSITIONS = [
  { value: 'bottom-right', label: 'Bas droite' },
  { value: 'bottom-left',  label: 'Bas gauche' },
  { value: 'top-right',    label: 'Haut droite' },
  { value: 'top-left',     label: 'Haut gauche' },
]

export default function ContratDetailPage() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const user      = useAuthStore((s) => s.user)
  const sigRef       = useRef(null)
  const initialsRef  = useRef(null)

  const [contrat,    setContrat]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [pdfFile,    setPdfFile]    = useState(null)   // File objet
  const [pdfUrl,     setPdfUrl]     = useState(null)   // URL.createObjectURL
  const [pdfBytes,   setPdfBytes]   = useState(null)   // ArrayBuffer
  const [pdfPageCount, setPdfPageCount] = useState(1)
  const [sigEmpty,   setSigEmpty]   = useState(true)
  const [signing,    setSigning]    = useState(false)
  const [signed,     setSigned]     = useState(false)
  const [error,      setError]      = useState(null)
  const [step,       setStep]       = useState(1)      // 1: infos  2: pdf  3: signature
  const [document_,  setDocument_]  = useState(null)   // document archivé (MongoDB)
  const [showMfaModal, setShowMfaModal] = useState(false)
  const [mfaCode,    setMfaCode]    = useState('')

  // Annulation / litige
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError,   setActionError]   = useState(null)
  const [showLitige,    setShowLitige]    = useState(false)
  const [litigeMotif,   setLitigeMotif]   = useState('')

  // Emplacement de la signature dans le PDF (GAP2)
  const [sigPage,     setSigPage]     = useState(null) // null = dernière page
  const [sigPosition, setSigPosition] = useState('bottom-right')
  const [addInitials, setAddInitials] = useState(false)

  const hasPdf = !!(pdfFile || document_?.pdf_base64)

  // Détermine le nombre de pages du PDF disponible (uploadé ou déjà archivé)
  useEffect(() => {
    const bytes = pdfBytes ?? (document_?.pdf_base64 ? base64ToArrayBuffer(document_.pdf_base64) : null)
    const countPromise = bytes ? PDFDocument.load(bytes).then((doc) => doc.getPageCount()) : Promise.resolve(1)
    countPromise.then(setPdfPageCount).catch(() => setPdfPageCount(1))
  }, [pdfBytes, document_])

  const loadDocument = () => {
    api.get(`/contrats/${id}/document`)
      .then(({ data }) => setDocument_(data))
      .catch(() => setDocument_(null))
  }

  const reloadContrat = async () => {
    const { data } = await api.get(`/contrats/${id}`)
    setContrat(data)
  }

  const handleAnnuler = async () => {
    if (!window.confirm('Annuler définitivement ce contrat ?')) return
    setActionError(null); setActionLoading(true)
    try {
      await api.put(`/contrats/${id}/annuler`)
      await reloadContrat()
    } catch (e) {
      setActionError(e.response?.data?.error || 'Annulation impossible')
    } finally { setActionLoading(false) }
  }

  const handleOuvrirLitige = async () => {
    setActionError(null); setActionLoading(true)
    try {
      await api.post(`/contrats/${id}/litige`, { motif: litigeMotif })
      setShowLitige(false); setLitigeMotif('')
      await reloadContrat()
    } catch (e) {
      setActionError(e.response?.data?.error || 'Ouverture du litige impossible')
    } finally { setActionLoading(false) }
  }

  useEffect(() => {
    api.get(`/contrats/${id}`)
      .then(({ data }) => {
        setContrat(data)
        // Déjà signé par l'utilisateur courant ?
        const isVendeur  = data.id_vendeur  === user?.id
        const isAcheteur = data.id_acheteur === user?.id
        if ((isVendeur && data.signe_vendeur) || (isAcheteur && data.signe_acheteur) || data.statut === 'termine') {
          setSigned(true)
        }
      })
      .catch(() => navigate('/contrats'))
      .finally(() => setLoading(false))
    loadDocument()
  }, [id, user?.id])

  // ─── Upload PDF ─────────────────────────────────────────────────────────────
  const handlePdfUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file || file.type !== 'application/pdf') return
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    const url = URL.createObjectURL(file)
    setPdfFile(file)
    setPdfUrl(url)
    file.arrayBuffer().then((buf) => setPdfBytes(buf))
    setStep(3)
  }

  // ─── Signer ─────────────────────────────────────────────────────────────────
  const handleSign = async (codeOverride) => {
    if (sigRef.current?.isEmpty()) {
      setError('Veuillez apposer votre signature.')
      return
    }
    if (addInitials && initialsRef.current?.isEmpty()) {
      setError('Veuillez apposer vos initiales ou décocher l\'option "Ajouter mes initiales".')
      return
    }

    // MFA requis avant signature
    if (user?.mfa_actif && !codeOverride) {
      setShowMfaModal(true)
      return
    }

    setSigning(true)
    setError(null)

    try {
      const sigDataUrl = sigRef.current.getCanvas().toDataURL('image/png')
      const initialsDataUrl = addInitials ? initialsRef.current.getCanvas().toDataURL('image/png') : null

      // Si un PDF est disponible (uploadé, ou déjà signé par l'autre partie) -> on y embed la signature
      let pdfBase64 = null
      const sourceBytes = pdfBytes ?? (document_?.pdf_base64 ? base64ToArrayBuffer(document_.pdf_base64) : null)
      if (sourceBytes) {
        const signedBytes = await embedSignatureToPdf(sourceBytes, sigDataUrl, {
          page: sigPage ?? pdfPageCount,
          position: sigPosition,
          initialsDataUrl,
        })
        pdfBase64 = arrayBufferToBase64(signedBytes)
        downloadPdf(signedBytes)
      }

      // Appel backend pour enregistrer la signature (et archiver le PDF + hash dans MongoDB)
      await api.put(`/contrats/${id}/signer`, {
        signature_dataurl: sigDataUrl,
        pdf_base64: pdfBase64,
        mfa_code: codeOverride ?? undefined,
      })

      setSigned(true)
      setShowMfaModal(false)
      setMfaCode('')
      // Recharge depuis l'API pour avoir l'état exact (signe_vendeur, signe_acheteur, statut)
      const { data: fresh } = await api.get(`/contrats/${id}`)
      setContrat(fresh)
      loadDocument()
      setStep(1)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Erreur lors de la signature')
    }
    setSigning(false)
  }

  const handleMfaSubmit = () => {
    if (mfaCode.length !== 6) return
    handleSign(mfaCode)
  }

  // ─── Embed signature (+ initiales) dans le PDF, retourne les octets du PDF signé ──
  const embedSignatureToPdf = async (pdfArrayBuffer, sigDataUrl, opts = {}) => {
    const pdfDoc = await PDFDocument.load(pdfArrayBuffer)
    const pages  = pdfDoc.getPages()

    // Page cible pour la signature complète (par défaut : dernière page)
    const pageIndex  = Math.min(Math.max((opts.page ?? pages.length) - 1, 0), pages.length - 1)
    const targetPage = pages[pageIndex]
    const { width, height } = targetPage.getSize()

    // Convertir la signature PNG en image pdf-lib
    const sigBytes = await fetch(sigDataUrl).then((r) => r.arrayBuffer())
    const sigImage = await pdfDoc.embedPng(sigBytes)
    const sigDims  = sigImage.scale(0.4)

    // Décale la zone si l'autre partie a déjà signé au même endroit
    const offset = document_?.signatures?.length > 0 ? sigDims.height + 35 : 0
    const { x: sigX, y: sigY } = signaturePosition(opts.position, width, height, sigDims, offset)

    // Ligne de signature
    targetPage.drawLine({
      start: { x: sigX - 10, y: sigY - 5 },
      end:   { x: sigX + sigDims.width + 10, y: sigY - 5 },
      thickness: 1,
      color: rgb(0.6, 0.6, 0.6),
    })

    // Image de la signature
    targetPage.drawImage(sigImage, { x: sigX, y: sigY, width: sigDims.width, height: sigDims.height })

    // Texte d'identification
    const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    targetPage.drawText(`Signé par : ${user?.prenom ?? ''} ${user?.nom ?? ''}  -  ${now}`, {
      x: sigX - 10,
      y: sigY - 18,
      size: 8,
      color: rgb(0.4, 0.4, 0.4),
    })

    // Paraphe (initiales) en bas au centre de chaque page
    if (opts.initialsDataUrl) {
      const initialsBytes = await fetch(opts.initialsDataUrl).then((r) => r.arrayBuffer())
      const initialsImage = await pdfDoc.embedPng(initialsBytes)
      const initDims      = initialsImage.scale(0.25)

      for (const page of pages) {
        const { width: pw } = page.getSize()
        page.drawImage(initialsImage, {
          x: pw / 2 - initDims.width / 2,
          y: 20,
          width: initDims.width,
          height: initDims.height,
        })
      }
    }

    return pdfDoc.save()
  }

  const downloadPdf = (bytes, filename = `contrat_${id}_signe.pdf`) => {
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url  = URL.createObjectURL(blob)
    const a    = window.document.createElement('a')
    a.href     = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadArchived = () => {
    if (!document_?.pdf_base64) return
    downloadPdf(base64ToArrayBuffer(document_.pdf_base64))
  }

  const clearSig = () => { sigRef.current?.clear(); setSigEmpty(true) }

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement...</div>
  if (!contrat) return null

  const isVendeur   = contrat.id_vendeur  === user?.id
  const isAcheteur  = contrat.id_acheteur === user?.id
  const isPartie    = isVendeur || isAcheteur
  const dejaSigné   = (isVendeur && contrat.signe_vendeur) || (isAcheteur && contrat.signe_acheteur)
  const canSign     = (contrat.statut === 'en_attente' || contrat.statut === 'signe')
                      && !dejaSigné
                      && contrat.statut !== 'termine'
                      && contrat.statut !== 'annule'
  // Annulable tant que l'autre partie n'a pas signé
  const autreASigné = isVendeur ? contrat.signe_acheteur : contrat.signe_vendeur
  const canCancel   = isPartie && ['en_attente', 'signe'].includes(contrat.statut) && !autreASigné
  // Litige possible uniquement sur un contrat terminé
  const canLitige   = isPartie && contrat.statut === 'termine'

  return (
    <div className="max-w-2xl space-y-4">

      {/* Retour */}
      <button onClick={() => navigate(-1)} className="text-sm text-[#2d7a5f] hover:underline inline-flex items-center gap-1.5">
        <ArrowLeft className="w-4 h-4" /> Retour aux contrats
      </button>

      {/* En-tête contrat */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Contrat #{contrat.id_contrat}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Créé le {contrat.date_creation
                ? new Date(contrat.date_creation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                : '-'}
            </p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${STATUS_COLORS[contrat.statut] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {STATUS_LABELS[contrat.statut] ?? contrat.statut}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-gray-500 text-xs mb-0.5">Points échangés</p>
            <p className="font-bold text-lg text-gray-800">
              {contrat.points_echanges > 0 ? `${contrat.points_echanges} pts` : 'Gratuit'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-gray-500 text-xs mb-0.5">Date de signature</p>
            <p className="font-semibold text-gray-800">
              {contrat.date_signature
                ? new Date(contrat.date_signature).toLocaleDateString('fr-FR')
                : '-'}
            </p>
          </div>
        </div>

        {contrat.statut === 'termine' && (
          <div className="mt-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            Contrat finalisé - {contrat.points_echanges > 0 ? `${contrat.points_echanges} points transférés.` : 'Service gratuit complété.'}
          </div>
        )}
        {signed && contrat.statut !== 'termine' && (
          <div className="mt-4 flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-4 py-3 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            Vous avez signé - en attente de la signature de l'autre partie.
          </div>
        )}

        {contrat.statut === 'litige' && (
          <div className="mt-4 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-5 h-5 shrink-0" /> Litige en cours de traitement par un administrateur.
            </div>
            {contrat.motif_litige && <p className="mt-1.5 text-orange-700">Motif : {contrat.motif_litige}</p>}
          </div>
        )}

        {/* Actions : annulation / litige */}
        {(canCancel || canLitige) && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {actionError && (
              <p className="mb-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {canCancel && (
                <button
                  onClick={handleAnnuler}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  <Ban className="w-4 h-4" /> Annuler le contrat
                </button>
              )}
              {canLitige && !showLitige && (
                <button
                  onClick={() => { setActionError(null); setShowLitige(true) }}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border border-orange-200 text-orange-700 hover:bg-orange-50 disabled:opacity-50 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" /> Ouvrir un litige
                </button>
              )}
            </div>

            {canLitige && showLitige && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={litigeMotif}
                  onChange={(e) => setLitigeMotif(e.target.value)}
                  rows={3}
                  placeholder="Décrivez le problème (service non rendu, qualité, etc.) — 5 caractères minimum"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleOuvrirLitige}
                    disabled={actionLoading || litigeMotif.trim().length < 5}
                    className="text-sm font-medium px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 transition-colors"
                  >
                    Envoyer le litige
                  </button>
                  <button
                    onClick={() => { setShowLitige(false); setLitigeMotif(''); setActionError(null) }}
                    className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Document signé archivé (MongoDB) */}
      {document_?.pdf_base64 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide text-gray-500">
            Document signé archivé
          </h3>
          {document_.hash_sha256 && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-500 text-xs mb-1">Hash SHA-256 (preuve d'intégrité)</p>
              <p className="font-mono text-xs text-gray-700 break-all">{document_.hash_sha256}</p>
            </div>
          )}
          <button
            onClick={handleDownloadArchived}
            className="w-full bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-2.5 rounded-xl transition-colors"
          >
            Télécharger le contrat signé
          </button>
        </div>
      )}

      {/* Participants et état des signatures */}
      {(contrat.id_vendeur || contrat.id_acheteur) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide text-gray-500">
            Signatures ({(contrat.signe_vendeur ? 1 : 0) + (contrat.signe_acheteur ? 1 : 0)} / 2)
          </h3>
          <div className="space-y-2">
            {/* Vendeur */}
            {contrat.id_vendeur && (
              <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                contrat.signe_vendeur ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#1a4a3a] rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {contrat.vendeur_prenom?.[0]}{contrat.vendeur_nom?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {contrat.vendeur_prenom} {contrat.vendeur_nom}
                      {contrat.id_vendeur === user?.id && <span className="ml-1.5 text-xs text-[#2d7a5f]">(vous)</span>}
                    </p>
                    <p className="text-xs text-gray-500">Prestataire</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  contrat.signe_vendeur ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                }`}>
                  {contrat.signe_vendeur ? 'Signé' : 'En attente'}
                </span>
              </div>
            )}

            {/* Acheteur */}
            {contrat.id_acheteur && (
              <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                contrat.signe_acheteur ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#2d7a5f] rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {contrat.acheteur_prenom?.[0]}{contrat.acheteur_nom?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {contrat.acheteur_prenom} {contrat.acheteur_nom}
                      {contrat.id_acheteur === user?.id && <span className="ml-1.5 text-xs text-[#2d7a5f]">(vous)</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      Bénéficiaire{contrat.points_echanges > 0 ? ` · ${contrat.points_echanges} pts` : ''}
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  contrat.signe_acheteur ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                }`}>
                  {contrat.signe_acheteur ? 'Signé' : 'En attente'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Étapes */}
      {canSign && (
        <div className="flex items-center gap-2">
          {[
            { n: 1, label: 'Informations' },
            { n: 2, label: 'Document PDF' },
            { n: 3, label: 'Signature' },
          ].map(({ n, label }, i, arr) => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => setStep(n)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  step === n
                    ? 'bg-[#1a4a3a] text-white'
                    : step > n
                    ? 'bg-[#34d399]/20 text-[#1a4a3a]'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  step > n ? 'bg-[#34d399] text-white' : ''
                }`}>
                  {step > n ? <Check className="w-3 h-3" /> : n}
                </span>
                {label}
              </button>
              {i < arr.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
            </div>
          ))}
        </div>
      )}

      {/* Étape 1 - Informations */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-semibold text-gray-800">Informations du contrat</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Ce contrat concerne un échange de service entre voisins sur la plateforme Quartio.
            {contrat.points_echanges > 0
              ? ` Il implique un échange de ${contrat.points_echanges} points.`
              : ' Il s\'agit d\'un service gratuit.'}
          </p>
          <p className="text-sm text-gray-500">
            En signant ce contrat, vous acceptez les termes de l'échange et vous engagez à respecter
            votre part de l'accord.
          </p>
          {canSign && (
            <button
              onClick={() => setStep(2)}
              className="w-full bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              Continuer <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Étape 2 - PDF */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-semibold text-gray-800">Document PDF (optionnel)</h3>

          {document_?.pdf_base64 ? (
            <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>Un document a déjà été déposé par l'autre partie - votre signature y sera ajoutée.</span>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Importez un document PDF si vous souhaitez y apposer votre signature. Votre signature
              sera intégrée dans le PDF et le fichier signé sera téléchargé automatiquement.
            </p>
          )}

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl py-8 px-4 cursor-pointer hover:border-[#34d399] hover:bg-[#f0faf5] transition-colors">
            <Upload className="w-6 h-6 text-gray-400 mb-2" />
            <span className="text-sm font-medium text-gray-700">
              {pdfFile ? pdfFile.name : 'Cliquez pour importer un PDF'}
            </span>
            <span className="text-xs text-gray-400 mt-1">Format PDF uniquement</span>
            <input type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
          </label>

          {pdfFile && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{pdfFile.name} chargé</span>
              <button
                onClick={() => { setPdfFile(null); setPdfUrl(null); setPdfBytes(null) }}
                className="ml-auto text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              {pdfFile ? 'Continuer' : 'Passer cette étape'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Étape 3 - Signature */}
      {step === 3 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-semibold text-gray-800">Apposez votre signature</h3>
          <p className="text-sm text-gray-500">
            Signez dans le cadre ci-dessous en utilisant votre souris ou votre doigt sur écran tactile.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Emplacement de la signature dans le PDF */}
          {hasPdf && (
            <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700">Emplacement de la signature dans le document</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Page</label>
                  <select
                    value={sigPage ?? pdfPageCount}
                    onChange={(e) => setSigPage(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {Array.from({ length: pdfPageCount }, (_, i) => i + 1).map((p) => (
                      <option key={p} value={p}>
                        Page {p}{p === pdfPageCount ? ' (dernière)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Position</label>
                  <select
                    value={sigPosition}
                    onChange={(e) => setSigPosition(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {SIGNATURE_POSITIONS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={addInitials}
                  onChange={(e) => setAddInitials(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Ajouter mes initiales en bas de chaque page ({pdfPageCount} page{pdfPageCount > 1 ? 's' : ''})
              </label>

              {addInitials && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Paraphe (2-3 lettres)</p>
                  <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-white inline-block">
                    <SignatureCanvas
                      ref={initialsRef}
                      penColor="#1a4a3a"
                      canvasProps={{
                        width: 160,
                        height: 80,
                        className: 'block',
                        style: { touchAction: 'none' },
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => initialsRef.current?.clear()}
                    className="ml-2 text-xs text-gray-400 hover:text-gray-600"
                  >
                    Effacer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Canvas de signature */}
          <div className="relative border-2 border-gray-200 rounded-xl overflow-hidden bg-gray-50">
            <SignatureCanvas
              ref={sigRef}
              penColor="#1a4a3a"
              canvasProps={{
                width: 560,
                height: 180,
                className: 'w-full',
                style: { touchAction: 'none' },
              }}
              onBegin={() => setSigEmpty(false)}
            />
            <div className="absolute bottom-2 left-4 text-xs text-gray-300 pointer-events-none select-none">
              Signez ici ×
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={clearSig}
              className="border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Effacer
            </button>
            <button onClick={() => setStep(2)} className="border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-xl hover:bg-gray-50 transition-colors text-sm flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>
            <button
              onClick={() => handleSign()}
              disabled={signing || sigEmpty}
              className="flex-1 bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {signing
                ? 'Signature en cours...'
                : pdfFile || document_?.pdf_base64
                ? 'Signer et télécharger le PDF'
                : 'Signer le contrat'}
            </button>
          </div>

          {(pdfFile || document_?.pdf_base64) && (
            <p className="text-xs text-gray-400 text-center">
              Le PDF signé sera téléchargé automatiquement après signature.
            </p>
          )}
        </div>
      )}

      {/* Aperçu PDF */}
      {pdfUrl && step === 2 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Aperçu du document</p>
            <span className="text-xs text-gray-400">{pdfFile?.name}</span>
          </div>
          <iframe
            src={pdfUrl}
            title="Aperçu PDF"
            className="w-full"
            style={{ height: 400 }}
          />
        </div>
      )}

      {/* Modale MFA - code TOTP requis avant signature */}
      {showMfaModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-semibold text-gray-800">Vérification en deux étapes</h3>
            <p className="text-sm text-gray-500">
              La signature de ce contrat est protégée par MFA. Saisissez le code de votre application d'authentification.
            </p>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
              className="w-full text-center text-2xl tracking-[0.5em] font-mono border border-gray-300 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-[#34d399]"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowMfaModal(false); setMfaCode(''); setError(null) }}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleMfaSubmit}
                disabled={signing || mfaCode.length !== 6}
                className="flex-1 bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {signing ? 'Vérification...' : 'Vérifier et signer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
