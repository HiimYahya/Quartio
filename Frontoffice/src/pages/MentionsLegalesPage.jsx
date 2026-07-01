import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </section>
  )
}

export default function MentionsLegalesPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#f0faf5] py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate(-1)} className="text-sm text-[#2d7a5f] hover:underline inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[#1a4a3a] rounded-xl flex items-center justify-center text-[#34d399]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Mentions légales & conditions</h1>
              <p className="text-xs text-gray-400">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>
            </div>
          </div>

          <Section title="1. Éditeur">
            <p>Quartio — plateforme d'entraide de quartier. Projet réalisé dans un cadre pédagogique (ESGI).
            Contact : <a href="mailto:contact@quartio.fr" className="text-[#2d7a5f] underline">contact@quartio.fr</a>.</p>
          </Section>

          <Section title="2. Conditions générales d'utilisation (CGU)">
            <p>En créant un compte, vous vous engagez à utiliser Quartio dans le respect des autres habitants :
            pas de contenu illégal, injurieux ou trompeur, pas d'usurpation d'identité, et un usage limité à votre quartier.</p>
            <p>Les services entre voisins s'échangent en « points ». Quartio n'est pas partie aux contrats conclus entre
            habitants et n'intervient qu'en cas de litige signalé, via ses outils de modération.</p>
            <p>Tout manquement peut entraîner la suspension ou la suppression du compte.</p>
          </Section>

          <Section title="3. Politique de confidentialité (RGPD)">
            <p>Nous collectons les données strictement nécessaires au service : identité (nom, prénom, email),
            quartier de rattachement, annonces, messages, votes, contrats et transactions de points.</p>
            <p>Vos données ne sont pas revendues. Conformément au RGPD, vous disposez d'un droit d'accès, de rectification
            et de suppression :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Exporter mes données</strong> : depuis votre profil, section « Mes données », vous téléchargez l'intégralité de vos données au format JSON.</li>
              <li><strong>Supprimer mon compte</strong> : depuis la même section, avec confirmation (mot de passe ou code MFA). Vos messages sont anonymisés pour préserver la cohérence des conversations ; les contrats sont conservés pour l'intégrité comptable.</li>
            </ul>
          </Section>

          <Section title="4. Cookies">
            <p>Quartio n'utilise que des cookies et un stockage local techniques, indispensables à votre connexion
            (jeton d'authentification) et à vos préférences (langue, consentement). Aucun traceur publicitaire n'est déposé.</p>
          </Section>

          <p className="text-xs text-gray-400 pt-2">
            Besoin d'aide ? Écrivez-nous à <a href="mailto:contact@quartio.fr" className="text-[#2d7a5f] underline">contact@quartio.fr</a>.
            Retour à <Link to="/login" className="text-[#2d7a5f] underline">la connexion</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
