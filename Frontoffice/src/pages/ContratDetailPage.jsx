import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import { PDFDocument, rgb } from 'pdf-lib'
import api from '../services/api'
import useAuthStore from '../store/authStore'

const STATUS_LABELS = {
  en_attente: 'En attente de signature',
  signe:      'Signature(s) reçue(s)',
  annule:     'Annulé',
  termine:    'Finalisé ✓',
}
const STATUS_COLORS = {
  en_attente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  signe:      'bg-blue-100 text-blue-700 border-blue-200',
  annule:     'bg-red-100 text-red-700 border-red-200',
  termine:    'bg-green-100 text-green-700 border-green-200',
}

export default function ContratDetailPage() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const user      = useAuthStore((s) => s.user)
  const sigRef    = useRef(null)

  const [contrat,    setContrat]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [pdfFile,    setPdfFile]    = useState(null)   // File objet
  const [pdfUrl,     setPdfUrl]     = useState(null)   // URL.createObjectURL
  const [pdfBytes,   setPdfBytes]   = useState(null)   // ArrayBuffer
  const [sigEmpty,   setSigEmpty]   = useState(true)
  const [signing,    setSigning]    = useState(false)
  const [signed,     setSigned]     = useState(false)
  const [error,      setError]      = useState(null)
  const [step,       setStep]       = useState(1)      // 1: infos  2: pdf  3: signature

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
  const handleSign = async () => {
    if (sigRef.current?.isEmpty()) {
      setError('Veuillez apposer votre signature.')
      return
    }
    setSigning(true)
    setError(null)

    try {
      // 1. Appel backend pour enregistrer la signature
      await api.put(`/contrats/${id}/signer`)

      // 2. Si un PDF a été chargé → on l'embed avec pdf-lib
      if (pdfBytes) {
        const sigDataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png')
        await embedSignatureToPdf(pdfBytes, sigDataUrl, contrat)
      }

      setSigned(true)
      // Recharge depuis l'API pour avoir l'état exact (signe_vendeur, signe_acheteur, statut)
      const { data: fresh } = await api.get(`/contrats/${id}`)
      setContrat(fresh)
      setStep(1)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Erreur lors de la signature')
    }
    setSigning(false)
  }

  // ─── Embed signature dans le PDF et déclenche le téléchargement ─────────────
  const embedSignatureToPdf = async (pdfArrayBuffer, sigDataUrl, contrat) => {
    const pdfDoc   = await PDFDocument.load(pdfArrayBuffer)
    const pages    = pdfDoc.getPages()
    const lastPage = pages[pages.length - 1]
    const { width, height } = lastPage.getSize()

    // Convertir la signature PNG en image pdf-lib
    const sigBytes = await fetch(sigDataUrl).then((r) => r.arrayBuffer())
    const sigImage = await pdfDoc.embedPng(sigBytes)
    const sigDims  = sigImage.scale(0.4)

    // Zone de signature en bas à droite
    const sigX = width  - sigDims.width  - 40
    const sigY = 40

    // Ligne de signature
    lastPage.drawLine({
      start: { x: sigX - 10, y: sigY - 5 },
      end:   { x: sigX + sigDims.width + 10, y: sigY - 5 },
      thickness: 1,
      color: rgb(0.6, 0.6, 0.6),
    })

    // Image de la signature
    lastPage.drawImage(sigImage, { x: sigX, y: sigY, width: sigDims.width, height: sigDims.height })

    // Texte d'identification
    const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    lastPage.drawText(`Signé par : ${user?.prenom ?? ''} ${user?.nom ?? ''}  —  ${now}`, {
      x: sigX - 10,
      y: sigY - 18,
      size: 8,
      color: rgb(0.4, 0.4, 0.4),
    })

    // Téléchargement
    const signedBytes = await pdfDoc.save()
    const blob = new Blob([signedBytes], { type: 'application/pdf' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `contrat_${id}_signe.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearSig = () => { sigRef.current?.clear(); setSigEmpty(true) }

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement…</div>
  if (!contrat) return null

  const isVendeur   = contrat.id_vendeur  === user?.id
  const isAcheteur  = contrat.id_acheteur === user?.id
  const dejaSigné   = (isVendeur && contrat.signe_vendeur) || (isAcheteur && contrat.signe_acheteur)
  const canSign     = (contrat.statut === 'en_attente' || contrat.statut === 'signe')
                      && !dejaSigné
                      && contrat.statut !== 'termine'
                      && contrat.statut !== 'annule'

  return (
    <div className="max-w-2xl space-y-4">

      {/* Retour */}
      <button onClick={() => navigate(-1)} className="text-sm text-[#2d7a5f] hover:underline">
        ← Retour aux contrats
      </button>

      {/* En-tête contrat */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Contrat #{contrat.id_contrat}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Créé le {contrat.date_creation
                ? new Date(contrat.date_creation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                : '—'}
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
                : '—'}
            </p>
          </div>
        </div>

        {contrat.statut === 'termine' && (
          <div className="mt-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm font-medium">
            <span className="text-lg">✓</span>
            Contrat finalisé — {contrat.points_echanges > 0 ? `${contrat.points_echanges} points transférés.` : 'Service gratuit complété.'}
          </div>
        )}
        {signed && contrat.statut !== 'termine' && (
          <div className="mt-4 flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-4 py-3 text-sm font-medium">
            <span className="text-lg">✓</span>
            Vous avez signé — en attente de la signature de l'autre partie.
          </div>
        )}
      </div>

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
                  {contrat.signe_vendeur ? '✓ Signé' : 'En attente'}
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
                  {contrat.signe_acheteur ? '✓ Signé' : 'En attente'}
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
                  {step > n ? '✓' : n}
                </span>
                {label}
              </button>
              {i < arr.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
            </div>
          ))}
        </div>
      )}

      {/* Étape 1 — Informations */}
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
              className="w-full bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-2.5 rounded-xl transition-colors"
            >
              Continuer →
            </button>
          )}
        </div>
      )}

      {/* Étape 2 — PDF */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-semibold text-gray-800">Document PDF (optionnel)</h3>
          <p className="text-sm text-gray-500">
            Importez un document PDF si vous souhaitez y apposer votre signature. Votre signature
            sera intégrée dans le PDF et le fichier signé sera téléchargé automatiquement.
          </p>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl py-8 px-4 cursor-pointer hover:border-[#34d399] hover:bg-[#f0faf5] transition-colors">
            <span className="text-3xl mb-2">📄</span>
            <span className="text-sm font-medium text-gray-700">
              {pdfFile ? pdfFile.name : 'Cliquez pour importer un PDF'}
            </span>
            <span className="text-xs text-gray-400 mt-1">Format PDF uniquement</span>
            <input type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" />
          </label>

          {pdfFile && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <span>✓</span>
              <span>{pdfFile.name} chargé</span>
              <button
                onClick={() => { setPdfFile(null); setPdfUrl(null); setPdfBytes(null) }}
                className="ml-auto text-gray-400 hover:text-gray-600"
              >✕</button>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
              ← Retour
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-2.5 rounded-xl transition-colors"
            >
              {pdfFile ? 'Continuer →' : 'Passer cette étape →'}
            </button>
          </div>
        </div>
      )}

      {/* Étape 3 — Signature */}
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
            <button onClick={() => setStep(2)} className="border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-xl hover:bg-gray-50 transition-colors text-sm">
              ← Retour
            </button>
            <button
              onClick={handleSign}
              disabled={signing || sigEmpty}
              className="flex-1 bg-[#1a4a3a] hover:bg-[#0f2e24] text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {signing
                ? 'Signature en cours…'
                : pdfFile
                ? '✍️ Signer et télécharger le PDF'
                : '✍️ Signer le contrat'}
            </button>
          </div>

          {pdfFile && (
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
    </div>
  )
}
