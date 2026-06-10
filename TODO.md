# Quartio — TODO exhaustif

> Basé sur le cahier des charges ESGI 3AL + état actuel du code.
> ✅ = déjà fait | ⬜ = à faire | 🔴 = critique (noté/évalué) | 🟡 = important | 🟢 = bonus

---

## BLOC 0 — DÉTAIL PAGE PAR PAGE

---

### FRONTOFFICE — Pages existantes

---

#### 🔐 LoginPage (`/login`)
- ✅ Formulaire email + mot de passe
- ✅ Lien vers l'inscription
- ✅ Gestion erreur identifiants incorrects
- ✅ Lien "Mot de passe oublié" → `/forgot-password`
- ✅ Détection MFA actif → après login réussi, rediriger vers `/mfa` si `mfa_required: true`
- ✅ Message spécifique si compte non vérifié ("Vérifiez votre email") + lien "Renvoyer le code"
- ⬜ Désactiver le bouton après 5 tentatives échouées (feedback visuel du blocage temporaire)

---

#### 📝 RegisterPage (`/register`)
- ✅ Formulaire nom, prénom, email, mot de passe
- ✅ Lien vers la connexion
- ✅ Après inscription réussie → rediriger vers `/verify-email` (pas `/login`)
- ⬜ 🟡 Champ téléphone (optionnel)
- ⬜ 🟡 Indicateur de force du mot de passe (barre colorée)
- ⬜ 🟡 Règles de mot de passe affichées (8 chars, 1 majuscule, 1 chiffre, 1 spécial)
- ⬜ Checkbox "J'accepte les CGU" obligatoire avec lien vers `/mentions-legales`
- ⬜ Confirmation mot de passe (double saisie)

---

#### ✉️ VerifyEmailPage (`/verify-email`) — À CRÉER
- ✅ Afficher l'email cible ("Un code a été envoyé à x@y.com")
- ✅ Input 6 chiffres (OTP) — 6 inputs séparés avec navigation clavier
- ✅ Bouton "Vérifier" → appel `POST /api/auth/verify-email`
- ✅ Compte à rebours "Ce code expire dans 14:52"
- ✅ Bouton "Renvoyer un nouveau code" (actif après 60s)
- ✅ Redirection vers `/login` avec message de succès si code valide

---

#### 🔑 ForgotPasswordPage (`/forgot-password`) — À CRÉER
- ✅ Champ email + bouton "Envoyer le lien"
- ✅ Message de confirmation générique (sécurité : ne pas confirmer l'existence du compte)
- ✅ Lien retour vers `/login`

---

#### 🔑 ResetPasswordPage (`/reset-password/:token`) — À CRÉER
- ✅ Validation du token (si invalide/expiré → message d'erreur affiché)
- ✅ Formulaire : nouveau mot de passe + confirmation
- ✅ Indicateur de force du mot de passe (barre + règles colorées)
- ✅ Après succès → redirection `/login` + message "Mot de passe mis à jour"

---

#### 🛡️ MfaVerifyPage (`/mfa`) — À CRÉER
- ✅ S'affiche après un login réussi si `mfa_required: true` dans la réponse
- ✅ Input code TOTP 6 chiffres + bouton "Vérifier"
- ✅ Appel `POST /api/auth/mfa/verify` → reçoit le vrai JWT
- ⬜ Lien "J'ai perdu mon accès à l'authentificateur" (contact admin)

---

#### 🏠 DashboardPage (`/dashboard`)
- ✅ Compteurs annonces / événements / votes
- ✅ Liens rapides vers sections
- ✅ Solde de points affiché
- ✅ Rôle utilisateur affiché
- ⬜ 🟡 Contrats en attente de signature (badge urgence si > 0)
- ⬜ 🟡 Dernières annonces du quartier (3-5 cartes)
- ⬜ 🟡 Prochains événements (date la plus proche)
- ⬜ 🟡 Section "Suggestions pour toi" basée sur Neo4j (recommandations événements)
- ⬜ 🟡 Voisins en ligne dans le quartier (avatars + compteur — Socket.io)
- ⬜ Notifications récentes non lues (3 dernières)

---

#### 📋 AnnoncesPage (`/annonces`)
- ✅ Liste des annonces (cartes avec titre, type, prix)
- ✅ Formulaire de création (titre, desc, type, payant, points, catégorie, quartier)
- ✅ Lien vers la page détail
- ⬜ 🟡 Upload jusqu'à 5 images à la création (Cloudinary)
- ⬜ 🟡 Filtres : type (offre/demande), catégorie, payant/gratuit, quartier
- ⬜ 🟡 Barre de recherche texte (titre + description)
- ⬜ 🟡 Onglets "Toutes" / "Mes annonces"
- ⬜ Pagination (bouton "Charger plus" ou infinite scroll)
- ⬜ Bouton "Modifier" et "Archiver" visibles sur ses propres annonces dans la liste
- ⬜ Badge "Contrat en cours" si on est déjà acheteur d'une annonce

---

#### 🔎 AnnonceDetailPage (`/annonces/:id`)
- ✅ Titre, description, type, prix
- ✅ Bouton "Accepter ce service" → crée le contrat + redirige
- ✅ Bouton "Contacter le voisin" → messages
- ✅ Message si c'est sa propre annonce
- ⬜ 🟡 Carousel d'images (si images uploadées)
- ⬜ 🟡 Bloc profil du vendeur : avatar, prénom, nb services rendus, membre depuis
- ⬜ 🟡 Bouton "Voir le profil" → `/profil/:id`
- ⬜ Bouton "Modifier" / "Archiver" si c'est sa propre annonce
- ⬜ Section "Autres annonces de ce voisin"
- ⬜ Statut visible (active / archivée / inactive)

---

#### 📅 EvenementsPage (`/evenements`)
- ✅ Liste événements (cartes)
- ✅ Vue swipe (react-tinder-card) avec react-spring
- ✅ Formulaire de création
- ✅ Enregistrer chaque swipe dans Neo4j (droite → `[:A_AIME]`, gauche → `[:A_IGNORE]`)
- ⬜ 🟡 Photo de couverture dans les cartes
- ⬜ 🟡 Section "Suggestions pour toi" (requête Neo4j basée sur swipes passés)
- ⬜ 🟡 Filtres : quartier, date, statut (planifié / en cours)
- ⬜ Indicateur "Inscrit ✓" sur les événements où on participe
- ⬜ Capacité restante affichée ("8 places restantes")
- ⬜ Swipe droite = inscription automatique (ou juste marquer l'intérêt)

---

#### 📅 EvenementDetailPage (`/evenements/:id`)
- ✅ Titre, description, dates, lieu
- ✅ Bouton "S'inscrire" / "Se désinscrire" (appel API `POST/DELETE /evenements/:id/participer`)
- ⬜ 🟡 Photo de couverture en header
- ⬜ 🟡 Nombre de participants inscrits / capacité max
- ⬜ 🟡 Liste des participants (avatars, 5 premiers + "et X autres")
- ⬜ 🟡 Mini-carte Leaflet avec marqueur sur le lieu
- ⬜ Bouton "Modifier" / "Annuler l'événement" si organisateur

---

#### 🗳️ VotesPage (`/votes`)
- ✅ Liste des votes avec options
- ✅ Voter pour une option (inline)
- ✅ Formulaire de création (titre, description, options)
- ⬜ 🟡 Affichage résultats après avoir voté (barres de progression % par option)
- ⬜ 🟡 Résultats en temps réel via Socket.io
- ⬜ Filtres : ouvert / fermé / archivé
- ⬜ Badge "Vous avez voté ✓" sur les votes déjà faits
- ⬜ Date de clôture visible + countdown si < 24h
- ⬜ Fermeture automatique à `date_fin` (job côté API ou check au chargement)

---

#### 💬 MessagesPage (`/messages`)
- ✅ Liste des conversations
- ✅ Lien vers chaque conversation
- ✅ Dernier message prévisualisé dans chaque carte (texte tronqué)
- ✅ Timestamp du dernier message ("il y a 5 min", "il y a 2h", etc.)
- ✅ Badge nombre de messages non lus par conversation
- ✅ Indicateur online/offline de l'interlocuteur (Socket.io)
- ⬜ 🟡 Bouton "Nouvelle conversation" + recherche d'un voisin par prénom/nom
- ⬜ Barre de recherche dans les conversations existantes
- ⬜ Archiver une conversation

---

#### 💬 ConversationPage (`/messages/:id`)
- ✅ Affichage des messages texte
- ✅ Envoi de messages texte
- ✅ Indicateur de frappe (typing — partiellement dans socketStore)
- ✅ Messages en temps réel (Socket.io — serveur implémenté)
- ✅ Présence online/offline de l'interlocuteur visible en haut
- ⬜ 🔴 Envoi d'images (bouton 📎 → Cloudinary → affichage inline)
- ⬜ 🔴 Messages vocaux (bouton 🎤 → MediaRecorder → upload → player audio inline)
- ⬜ 🟡 Scroll automatique vers le bas sur nouveau message
- ⬜ 🟡 Messages lus / non lus (simple indicateur)
- ⬜ 🟡 Bouton "Signaler ce message" (3 points → menu contextuel)
- ⬜ Répondre à un message (citation)
- ⬜ Sélectionner + supprimer ses propres messages
- ⬜ 🟢 Emoji picker

---

#### 📄 ContratsPage (`/contrats`)
- ✅ Liste contrats triée (en attente en priorité)
- ✅ Badge "À signer →"
- ✅ Statut coloré par carte
- ⬜ 🟡 Badge sur l'icône de navigation dans la sidebar si contrats en attente
- ⬜ Filtres par statut (en attente / signé / terminé / annulé)
- ⬜ Tri par date

---

#### 📄 ContratDetailPage (`/contrats/:id`)
- ✅ Infos contrat (points échangés, dates)
- ✅ Bloc participants (vendeur/acheteur) + état de chaque signature
- ✅ Étapes : infos → upload PDF → signature canvas
- ✅ Embed de la signature dans le PDF + téléchargement
- ✅ Rechargement après signature
- ⬜ 🔴 MFA requis avant signature (modal saisie TOTP → `POST /api/auth/mfa/verify`)
- ⬜ 🔴 Télécharger le contrat final signé depuis MongoDB (si finalisé)
- ⬜ 🔴 Hash SHA-256 du document affiché (preuve d'intégrité)
- ⬜ 🟡 Résumé de l'annonce liée (titre, description)
- ⬜ 🟡 Bouton "Annuler le contrat" (si statut en_attente et l'autre n'a pas encore signé)
- ⬜ 🟡 Bouton "Ouvrir un litige" (si statut terminé et problème)
- ⬜ Génération automatique d'un PDF de contrat (si aucun PDF fourni par l'utilisateur)

---

#### ⚠️ IncidentsPage (`/incidents`)
- ✅ Liste des incidents (avec statut et priorité colorés)
- ✅ Formulaire de signalement (titre, desc, type, priorité)
- ⬜ 🟡 Upload photos jointes à l'incident (Cloudinary)
- ⬜ 🟡 Onglets "Mes signalements" / "Tous les incidents du quartier"
- ⬜ Notification quand le statut de son incident change
- ⬜ Possibilité de localiser l'incident sur la carte (clic → coordonnées)

---

#### 👤 ProfilPage (`/profil`)
- ✅ Modifier nom, prénom, email (basique)
- ✅ Mon quartier (détection par adresse + affichage)
- ✅ Historique transactions (points)
- ✅ Solde de points
- ✅ Rôle affiché
- ✅ Déconnexion
- ✅ Switcher de langue
- ⬜ 🟡 Photo de profil (upload Cloudinary + aperçu instantané)
- ⬜ 🔴 Section "Sécurité" :
  - ⬜ Changer le mot de passe (actuel → nouveau → confirmation + MFA)
  - ⬜ Changer l'email (nouveau email → re-vérification + MFA)
  - ⬜ Changer le téléphone (+ MFA)
  - ⬜ Activer/Désactiver le MFA (bouton → modale QR code + instructions)
  - ⬜ Sessions actives (liste des refresh tokens) + bouton "Déconnecter partout"
- ✅ Section "Mes données (RGPD)" :
  - ⬜ Bouton "Exporter mes données" → télécharge un JSON complet
  - ⬜ Bouton "Supprimer mon compte" (confirmation + MFA obligatoire)
- ⬜ 🟡 Préférences notifications (email / in-app, par type d'événement)
- ⬜ 🟡 Mes voisins fiables (liste Neo4j des utilisateurs avec qui des contrats ont été finalisés)
- ⬜ Stats personnelles : nb services rendus, nb services reçus, nb événements participés

---

#### 🗺️ CartePage (`/carte`)
- ✅ Affichage polygones des quartiers
- ✅ Marqueurs annonces et événements
- ✅ Filtres couches (tout / annonces / événements)
- ✅ Sélection d'un quartier → affiche ses annonces et événements
- ✅ FlyTo sur le quartier sélectionné
- ⬜ 🟡 Couche "Incidents" (marqueurs rouges pour chaque incident ouvert)
- ⬜ Filtre incidents dans le sélecteur de couches
- ⬜ Popup incident : titre, priorité, statut, bouton "Voir"
- ⬜ 🟢 Voisins en ligne (points animés bleus sur leur quartier — Socket.io)

---

#### 👤 ProfilPublicPage (`/profil/:id`) — À CRÉER
- ⬜ 🟡 Avatar + nom + membre depuis
- ⬜ 🟡 Nb services rendus et reçus
- ⬜ 🟡 Ses annonces actives
- ⬜ Bouton "Envoyer un message" → crée ou ouvre une conversation
- ⬜ Évaluation / réputation (optionnel)

---

#### 🔔 NotificationsPage (`/notifications`) — À CRÉER ou intégrer dans la sidebar
- ⬜ 🟡 Liste toutes les notifications avec type (message, contrat, événement, vote, incident)
- ⬜ 🟡 Marquer comme lue (clic sur la notification)
- ⬜ 🟡 Bouton "Tout marquer comme lu"
- ⬜ Supprimer une notification
- ⬜ Clic → redirige vers la ressource concernée

---

#### 📜 MentionsLegalesPage (`/mentions-legales`) — À CRÉER
- ⬜ 🟡 Politique de confidentialité (conformité RGPD)
- ⬜ CGU (conditions générales d'utilisation)
- ⬜ Informations sur les cookies

---

---

### BACKOFFICE — Pages existantes

---

#### 🔐 LoginPage (backoffice)
- ✅ Formulaire email + mot de passe
- ✅ Vérification `role === 'admin'` avant accès
- ⬜ 🔴 Écran MFA si activé (code TOTP)
- ⬜ Lien "Mot de passe oublié"

---

#### 📊 DashboardPage (backoffice)
- ✅ Compteurs : utilisateurs, incidents, votes, annonces, événements
- ✅ État des services (API, MongoDB, PostgreSQL, Neo4j) — statut opérationnel
- ✅ Actions rapides (liens)
- ✅ Graphiques d'activité : nouveaux users / semaine, annonces créées / semaine, points échangés / semaine
- ✅ Incidents urgents (critique/haute) mis en avant avec badge rouge dans le Dashboard
- ⬜ 🟡 Volume de points échangés total (KPI)
- ⬜ 🟡 5 dernières inscriptions (mini-tableau)
- ⬜ 🟡 Taux de complétion des contrats (terminés vs annulés)
- ⬜ Export des stats en CSV

---

#### 👥 UtilisateursPage (backoffice)
- ✅ Liste avec recherche texte et filtre par rôle
- ✅ Changement de rôle inline (dropdown)
- ✅ Création utilisateur (modale : prénom, nom, email, mdp, rôle, langue)
- ✅ Suppression avec modale de confirmation
- ⬜ 🟡 Suspendre un compte (toggle + durée) → utilisateur bloqué temporairement
- ⬜ 🟡 Créditer / Débiter manuellement des points (modale avec montant + motif)
- ⬜ Colonne "Email vérifié" (✓ ou ✗) + bouton "Forcer la vérification"
- ⬜ Voir les contrats / annonces de cet utilisateur (lien ou modale)
- ⬜ Export de la liste en CSV

---

#### 🗺️ QuartiersPage (backoffice)
- ✅ CRUD complet (liste + formulaire + suppression)
- ✅ Carte interactive pour dessiner les polygones
- ✅ Détection de chevauchement (frontend + backend)
- ✅ Sélection quartier → highlight sur la carte
- ✅ Raccourcis clavier dessin (Backspace, Escape)
- ✅ Déplacement de points
- ✅ Modal suppression via createPortal (au-dessus de la carte)
- ⬜ 🟡 Voir les habitants du quartier (clic "Habitants" → liste filtrée)
- ⬜ Stats par quartier dans la liste : nb habitants, nb annonces actives, nb événements prévus

---

#### 📋 AnnoncesPage (backoffice)
- ✅ Liste avec filtres statut (all / active / inactive / archivée)
- ✅ Changement de statut inline
- ✅ Archiver rapide
- ✅ Supprimer avec modale
- ✅ Créer une annonce (modale)
- ⬜ 🟡 Afficher les images si présentes
- ⬜ Lien vers le contrat associé si existe
- ⬜ Filtres par quartier et par utilisateur auteur

---

#### 📅 EvenementsPage (backoffice)
- ✅ Liste, CRUD, changement statut
- ✅ Supprimer avec modale
- ✅ Créer un événement (modale)
- ⬜ Voir les participants (clic → modale avec liste)
- ⬜ Afficher la photo de couverture

---

#### 🗳️ VotesPage (backoffice)
- ✅ Liste, CRUD, changement statut
- ✅ Supprimer avec modale
- ✅ Créer un vote avec options dynamiques
- ⬜ 🟡 Voir les résultats (bouton "Résultats" → graphique en barres dans une modale)
- ⬜ Fermer un vote manuellement

---

#### ⚠️ IncidentsPage (backoffice)
- ✅ Liste avec filtres statut (tous / ouvert / en cours / résolu / fermé)
- ✅ Changement de statut inline
- ✅ Supprimer avec modale de confirmation
- ✅ Créer un incident (modale avec priorité)
- ⬜ 🟡 Voir les photos jointes à un incident
- ⬜ Voir la localisation sur une mini-carte (si coordonnées disponibles)
- ⬜ Assigner un incident à un modérateur
- ⬜ Historique des changements de statut (log)

---

#### 📄 ContratsPage (backoffice)
- ✅ Liste, changement de statut inline
- ✅ Supprimer avec modale
- ⬜ 🔴 Voir le PDF signé archivé (bouton "Document" → ouvre l'URL Cloudinary)
- ⬜ 🟡 Gestion des litiges (colonne + filtre "En litige" + actions admin)
- ⬜ Infos vendeur/acheteur cliquables (lien vers leur profil)

---

#### 🚨 SignalementsPage (`/signalements`) — À CRÉER (backoffice)
- ⬜ 🟡 Liste des messages signalés (auteur, contenu, conversation, date)
- ⬜ 🟡 Actions : supprimer le message / avertir l'utilisateur / ignorer le signalement
- ⬜ Compteur de signalements non traités (badge dans le menu)

---

#### 📊 StatistiquesPage (`/statistiques`) — À CRÉER (backoffice)
- ✅ Graphiques sur 8 semaines : inscriptions, annonces, événements, points échangés
- ✅ Classement des utilisateurs par points (top 10)
- ✅ Services les plus demandés (top catégories — camembert Recharts)
- ⬜ Export en CSV

---

#### 💻 ConsolePage (`/console`) — À CRÉER (backoffice)
- ✅ Interface du langage d'interrogation maison MongoDB (ConsolePage backoffice)
- ✅ Éditeur de requêtes (thème sombre, Ctrl+Entrée, Tab, exemples rapides, aide syntaxe)
- ✅ Affichage des résultats en tableau JSON + vue AST
- ⬜ Historique des requêtes

---

#### ⚖️ LitigesPage (`/litiges`) — À CRÉER (backoffice)
- ⬜ 🟡 Liste des contrats en litige
- ⬜ 🟡 Outils admin : rembourser les points, clore le litige, contacter les parties
- ⬜ Historique des litiges résolus

---

### GAPS IDENTIFIÉS APRÈS RELECTURE DU CAHIER DES CHARGES

Ces points étaient **absents ou incomplets** dans les blocs ci-dessus.

---

#### 🟡 GAP 1 — Rôle MODÉRATEUR (absent de toutes les pages)

Le cahier des charges exige **3 rôles** : habitants, **modérateurs**, administrateurs.
Le rôle `moderateur` existe en base mais n'est associé à aucune interface ni permission précise.

**Ce qu'un modérateur doit pouvoir faire (à définir dans le code et les routes) :**
- ✅ Accéder au backoffice avec le rôle `moderateur` (login + fetchMe mis à jour)
- ⬜ 🔴 Voir et traiter les messages signalés (`SignalementsPage`)
- ✅ Modifier le statut des incidents (accès backoffice IncidentsPage pour modérateurs)
- ✅ Modérer les annonces (accès backoffice AnnoncesPage pour modérateurs)
- ✅ Sidebar filtrée par rôle : modérateur voit Incidents + Annonces uniquement
- ⬜ 🟡 **Ne peut pas** : gérer les quartiers, changer les rôles, supprimer des comptes, accéder aux stats
- ⬜ Middleware `role('admin', 'moderateur')` sur les routes concernées
- ⬜ Route `/api/auth/login` backoffice : accepter aussi `role === 'moderateur'` (pas que `admin`)
- ⬜ Sidebar backoffice : sections visibles selon le rôle connecté

---

#### 📝 GAP 2 — Initiales dans les contrats PDF (distinct de la signature)

Le cahier des charges dit **"zones de signature / initiales"**. Les initiales (paraphe) sont différentes d'une signature complète : elles sont placées en bas de chaque page du document pour attester que l'utilisateur a bien lu chaque page.

**Sur ContratDetailPage :**
- ⬜ 🔴 Permettre de placer des **zones d'initiales** (petit canvas, 2-3 lettres) en bas de chaque page du PDF
- ⬜ 🔴 Permettre de placer des **zones de signature complète** à un endroit précis (pas seulement en bas à droite de la dernière page)
- ⬜ 🟡 Interface drag & drop : glisser une zone "Signature" ou "Initiales" sur le PDF avant de l'envoyer à l'autre partie
- ⬜ Chaque zone est associée à un signataire (vendeur ou acheteur)
- ⬜ L'autre partie voit les zones qui lui sont destinées et ne peut signer qu'aux bons endroits

---

#### 🗳️ GAP 3 — Votes "paramétrables et extensibles"

Le cahier des charges dit **"système de gestion paramétrable et extensible"**. Actuellement les votes ne supportent qu'un seul type (choix multiple). "Paramétrable" implique des configurations différentes.

**Sur VotesPage et ContratDetailPage (création de vote) :**
- ✅ Type de vote configurable : `choix_multiple` / `oui_non` / `classement`
- ✅ Pour `oui_non` : options "Oui"/"Non" générées automatiquement côté backend
- ✅ Pour `classement` : UI ↑/↓ pour ordonner les options, soumission du classement
- ⬜ 🟡 Cible du vote : tout le quartier, ou un sous-groupe (habitants d'un quartier spécifique)
- ⬜ 🟡 Vote à choix unique vs vote à choix multiples (paramètre `nb_choix_max`)
- ⬜ Fermeture automatique à `date_fin` (cron côté API ou check au chargement)
- ⬜ Résultats affichés différemment selon le type (barres pour choix multiple, podium pour classement)
- ⬜ Ajouter `type_vote` et `nb_choix_max` au schéma MongoDB Vote

---

#### 🔔 GAP 4 — Alertes temps réel (distinct du chat)

Le cahier des charges dit que Socket.io gère **"Chat, présences online/offline, alertes"**. Les alertes sont un canal distinct du chat.

**Alertes à émettre via Socket.io (en plus des messages) :**
- ✅ `alert:incident` → incidents haute/critique → broadcast à tous les connectés
- ✅ `alert:contrat` → contrat en attente de signature → alerte ciblée (destinataire uniquement)
- ✅ `alert:vote` → nouveau vote → broadcast à tous les connectés
- ⬜ 🟡 `alert:evenement` → quand un événement est créé dans son quartier
- ⬜ **DashboardPage** : afficher les alertes actives en haut de page (bannière rouge pour incident critique)
- ⬜ **Sidebar** : badge rouge animé pour les alertes non lues (distinct des notifications normales)
- ⬜ `GET /api/alertes` → liste des alertes actives pour l'utilisateur

---

#### 🗄️ GAP 5 — MongoDB pour les contrats et signatures (architecture BDD)

La stack technique précise : **"MongoDB : stockage des documents (contrats, signatures), événements, messages"**. Actuellement les contrats sont en PostgreSQL uniquement. Les **documents contractuels et les signatures** doivent être dans MongoDB.

**Architecture corrigée :**
- ⬜ 🔴 Créer un modèle MongoDB `ContratDocument` : `{ id_contrat_pg, pdf_url, hash_sha256, signatures: [{id_utilisateur_pg, dataurl, signed_at, ip}], created_at }`
- ⬜ 🔴 PostgreSQL garde les métadonnées du contrat (statut, points, parties, dates)
- ⬜ 🔴 MongoDB stocke les PDFs signés et les données de signature
- ⬜ 🔴 Neo4j garde les relations `[:SIGNE]` entre utilisateurs et contrats
- ⬜ `GET /api/contrats/:id/document` → interroge MongoDB pour le PDF archivé
- ⬜ **ContratDetailPage** : bouton "Télécharger le contrat signé" visible une fois les 2 signatures validées

---

#### 🧩 GAP 6 — Extensibilité sans modifier le code existant (web)

Le cahier des charges dit : **"il doit être possible de rajouter des modules qui vous paraîtraient intéressants, en prévoyant un système qui permette de le faire sans modifier le code existant"**.

Cela s'applique au web (pas seulement à l'app Java).

**Côté API (Node.js) :**
- ⬜ 🔴 Système de **route registry** : chaque nouveau module dépose son fichier de routes dans `src/routes/` et est chargé automatiquement par `src/routes/index.js` (déjà partiellement le cas — documenter comme pattern officiel)
- ⬜ 🔴 Système de **hook/events** interne : un module peut s'abonner à des événements (ex: `contrat.finalise`, `incident.cree`) sans modifier les controllers existants
- ⬜ `POST /api/modules/register` → endpoint pour enregistrer un module externe (optionnel)

**Côté Frontoffice :**
- ⬜ 🟡 Système de **navigation dynamique** : les liens de la sidebar sont générés depuis une config, pas codés en dur — l'ajout d'une page ne nécessite pas de modifier `Sidebar.jsx`
- ⬜ 🟡 Documenter comment ajouter un module (nouvelle page + route API) sans toucher aux fichiers existants

---

## LÉGENDE STATUTS
- ✅ Terminé
- ⬜ À faire
- 🚧 En cours / partiel

---

## BLOC 1 — Infrastructure de base (prérequis à tout le reste)

### 1.1 Service email (Nodemailer + Mailtrap/SendGrid)
- ⬜ 🔴 Choisir et configurer un provider email (Mailtrap pour dev, SendGrid pour prod)
- ⬜ 🔴 Créer le service `mailer.js` dans l'API (templates HTML)
- ⬜ 🔴 Variables d'environnement : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
- ⬜ Créer les templates email : vérification, reset mdp, notification contrat, bienvenue

### 1.2 Cloudinary (stockage images)
- ⬜ 🟡 Créer un compte Cloudinary et récupérer les credentials
- ⬜ 🟡 Installer `cloudinary` + `multer` dans l'API
- ⬜ 🟡 Créer le middleware `upload.middleware.js` (validation type/taille)
- ⬜ 🟡 Variables d'environnement : `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### 1.3 Multi-environnements Docker
- ⬜ 🔴 Séparer `docker-compose.dev.yml` / `docker-compose.prod.yml` / `docker-compose.test.yml`
- ⬜ Fichiers `.env.dev`, `.env.prod`, `.env.test` (jamais commités)
- ⬜ `.env.example` complet avec toutes les variables documentées

---

## BLOC 2 — Authentification & Sécurité 🔴 (noté)

### 2.1 Vérification email à l'inscription
- ✅ Table `email_verification` (token, user_id, expire_le, utilisé)
- ✅ `POST /api/auth/register` → envoie un email avec code OTP à 6 chiffres (valable 15 min)
- ✅ `POST /api/auth/verify-email` → vérifie le code et active le compte (`email_verifie = true`)
- ✅ Bloquer la connexion si email non vérifié (message explicite)
- ✅ `POST /api/auth/resend-verification` → renvoie un nouveau code
- ✅ Page Frontoffice : écran "Vérifiez votre email" avec champ de saisie du code
- ✅ Ajouter colonne `email_verifie BOOLEAN DEFAULT FALSE` à la table `utilisateur`

### 2.2 Mot de passe oublié
- ✅ Table `password_reset` (token UUID, user_id, expire_le, utilisé)
- ✅ `POST /api/auth/forgot-password` → envoie email avec lien de reset (valable 1h)
- ✅ `POST /api/auth/reset-password` → valide le token et change le mot de passe
- ✅ Page Frontoffice : formulaire "Mot de passe oublié" accessible depuis le login
- ✅ Page Frontoffice : formulaire "Nouveau mot de passe" (lien depuis email)
- ✅ Invalider tous les refresh tokens après reset du mot de passe

### 2.3 MFA / TOTP 🔴 (explicitement demandé dans le cahier des charges)
> La colonne `mfa_secret` existe déjà dans la table `utilisateur`

- ✅ Installer `speakeasy` + `qrcode` dans l'API
- ✅ `GET /api/auth/mfa/setup` → génère le secret TOTP + QR code (à scanner dans Google Authenticator)
- ✅ `POST /api/auth/mfa/activate` → vérifie un premier code TOTP et active le MFA
- ✅ `POST /api/auth/mfa/disable` → désactive le MFA (nécessite un code TOTP valide)
- ✅ Modifier `POST /api/auth/login` : si MFA activé → retourner `mfa_required: true` + token temporaire (10 min)
- ✅ `POST /api/auth/mfa/verify` → vérifie le code TOTP et retourne le vrai JWT
- ✅ `POST /api/auth/mfa/verify-action` → endpoint pour actions sensibles (signature contrat, etc.)
- ✅ Page Frontoffice : configuration MFA dans les paramètres du profil (QR code + instructions + désactivation)
- ✅ Page Frontoffice : écran de saisie du code TOTP lors de la connexion (/mfa)
- ⬜ Backoffice : idem pour les admins

### 2.4 Validation mot de passe & sécurité front
- ⬜ 🟡 Indicateur de force du mot de passe sur les formulaires d'inscription et de reset
- ⬜ 🟡 Règles : min 8 chars, 1 majuscule, 1 chiffre, 1 caractère spécial
- ⬜ Blocage après N tentatives de connexion échouées (N=5, durée 15 min) côté front (déjà côté back)
- ⬜ Message d'erreur générique pour login (ne pas indiquer si email existe ou non)

### 2.5 SSO Web ↔ Java Desktop 🔴 (demandé dans le cahier des charges)
- ✅ Endpoint `GET /api/auth/sso-token` → génère un token JWT signé à courte durée (5 min) pour l'app Java
- ✅ L'app Java utilise ce token pour s'authentifier côté API (documenté dans Swagger)
- ⬜ Documenter le flux SSO dans le Swagger

---

## BLOC 3 — RGPD 🔴 (noté explicitement)

### 3.1 Droits des utilisateurs
- ✅ `GET /api/rgpd/export` → export JSON complet (profil, annonces, messages, contrats, votes, transactions, notifications, relations Neo4j)
- ✅ `DELETE /api/rgpd/delete-account` → suppression cascade (PostgreSQL + MongoDB + Neo4j) — MFA si activé, sinon mot de passe
- ⬜ 🟡 `GET /api/rgpd/mes-donnees` → liste des données stockées par catégorie (transparence)
- ✅ Page Frontoffice "Mes données (RGPD)" dans le profil : export JSON + suppression en 3 étapes (bouton → confirmation → code MFA ou mdp)

### 3.2 Consentements
- ⬜ 🟡 Bannière de consentement cookies à la première visite
- ⬜ 🟡 Mentions légales & Politique de confidentialité (pages statiques)
- ⬜ Checkbox "J'accepte les CGU" obligatoire à l'inscription

### 3.3 Anonymisation
- ✅ Lors de la suppression de compte : messages anonymisés (contenu → "[Message supprimé]") pour préserver la cohérence des conversations

---

## BLOC 4 — Temps réel Socket.io 🔴 (messagerie en temps réel demandée)

> Socket.io est déjà partiellement configuré côté front (socketStore) mais le back n'a pas de serveur Socket.io

### 4.1 Serveur Socket.io backend
- ✅ Créer `src/socket/index.js` — initialise Socket.io sur le serveur HTTP Express
- ✅ Authentification des connexions WebSocket via JWT (middleware Socket.io)
- ✅ Gestion des rooms de conversation (`join:conversation`, `leave:conversation`)
- ✅ Événements émis : `message:new`, `user:online`, `user:offline`, `presence:snapshot`, `typing:start`, `typing:stop`
- ✅ Stocker la présence online/offline en mémoire (Map userId → Set de socketIds)

### 4.2 Messagerie en temps réel
- ✅ Quand `POST /api/conversations/:id/messages` → émettre `message:new` à tous les participants de la room
- ✅ Frontoffice MessagesPage / ConversationPage : recevoir les nouveaux messages en temps réel sans rechargement
- ✅ Indicateurs de frappe (typing indicators) dans la ConversationPage
- ✅ Présence online/offline des voisins visible dans la liste des conversations et dans le profil

### 4.3 Notifications temps réel
- ✅ `emitNotification(userId, notif)` disponible dans le socket pour émettre `notification:new`
- ⬜ 🟡 Badge de notifications dans la topbar mis à jour en temps réel

---

## BLOC 5 — Messagerie multimédia 🔴 (photos + vocaux demandés)

### 5.1 Photos dans les messages
- ⬜ 🔴 `POST /api/conversations/:id/messages/media` → upload image via Cloudinary, retourne le message créé
- ⬜ 🔴 Modèle Message MongoDB : ajouter `type` (text/image/audio) et `media_url`
- ⬜ 🔴 Frontoffice ConversationPage : bouton upload image, affichage inline des images
- ⬜ 🔴 Émettre `message:new` avec le message média via Socket.io

### 5.2 Messages vocaux
- ⬜ 🔴 Frontoffice : bouton d'enregistrement vocal (MediaRecorder API), upload du fichier audio vers Cloudinary
- ⬜ 🔴 Affichage d'un player audio inline dans la conversation
- ⬜ Durée max : 2 minutes

### 5.3 Appels vidéo (🟢 bonus)
- ⬜ 🟢 Intégrer WebRTC ou un service tiers (Agora, Daily.co) pour les appels vidéo entre voisins
- ⬜ 🟢 Bouton "Appel vidéo" dans la ConversationPage

---

## BLOC 6 — Annonces & Services

### 6.1 Images dans les annonces
- ⬜ 🟡 `POST /api/annonces/:id/images` → upload jusqu'à 5 images via Cloudinary
- ⬜ 🟡 Modèle Annonce MongoDB : ajouter `images: [String]`
- ⬜ 🟡 Frontoffice AnnoncesPage : carousel d'images dans les cartes + formulaire d'upload
- ⬜ Backoffice : affichage des images dans la liste

### 6.2 Recherche et filtres
- ⬜ 🟡 `GET /api/annonces?search=mot&type=offre&categorie=sport&payant=false&quartier=1`
- ⬜ 🟡 Frontoffice : barre de recherche + filtres avancés (type, catégorie, payant/gratuit, quartier)
- ⬜ Index MongoDB sur `titre` et `description` pour la recherche full-text

### 6.3 Expiration et gestion cycle de vie
- ⬜ Annonce automatiquement archivée X jours après publication (configurable)
- ⬜ Frontoffice : afficher la date d'expiration sur chaque annonce

### 6.4 Système de points complet
- ⬜ 🔴 Points offerts à l'inscription (ex: 100 pts de bienvenue)
- ⬜ 🔴 L'auteur d'une annonce définit le coût en points — le service doit être décrit explicitement
- ⬜ Dashboard : historique complet des points avec motif (gain/perte)
- ⬜ Backoffice : pouvoir créditer/débiter manuellement un compte

---

## BLOC 7 — Contrats & Signatures 🔴

### 7.1 Archivage MongoDB
> Le sujet demande : "MongoDB : stockage des documents (contrats, signatures)"
- ⬜ 🔴 Créer un modèle MongoDB `Signature` : `{ id_contrat, id_utilisateur, signature_dataurl, pdf_url, signed_at }`
- ⬜ 🔴 Lors de la signature : uploader le PDF signé sur Cloudinary et stocker l'URL dans MongoDB
- ⬜ 🔴 `GET /api/contrats/:id/document` → retourne le PDF signé archivé (URL Cloudinary)

### 7.2 Zones de signature dans le PDF
- ⬜ 🟡 Permettre de placer des zones de signature/initiales à des endroits précis du PDF (drag & drop)
- ⬜ 🟡 Chaque zone est associée à un signataire (vendeur ou acheteur)
- ⬜ 🟡 Générateur de contrat PDF automatique si aucun PDF fourni (pdf-lib : template avec infos du service)

### 7.3 Sécurisation des signatures
- ⬜ 🔴 MFA requis avant signature (code TOTP vérifié côté serveur)
- ⬜ 🔴 Hash SHA-256 du document signé stocké en base (preuve d'intégrité)
- ⬜ 🟡 Horodatage serveur de chaque signature (non falsifiable côté client)

### 7.4 Flux contrat — cas manquants
- ⬜ 🟡 `PUT /api/contrats/:id/annuler` → annulation par l'une des parties (avec règles : seulement si non signé par l'autre)
- ⬜ 🟡 `POST /api/contrats/:id/litige` → ouvrir un litige (admin notifié)
- ⬜ Frontoffice : bouton "Annuler le contrat" avec confirmation
- ⬜ Backoffice : gestion des litiges

---

## BLOC 8 — Événements & Recommandations Neo4j 🔴

### 8.1 Moteur de recommandations (Neo4j)
- ✅ Enregistrer les interactions dans Neo4j : `(u)-[:A_AIME]->(e)` (swipe droite), `(u)-[:A_IGNORE]->(e)` (swipe gauche)
- ✅ `GET /api/evenements/suggestions` → requête Cypher basée sur les événements des voisins ayant des intérêts communs
  ```cypher
  MATCH (me:Utilisateur {pg_id: $uid})-[:PARTICIPE]->(e1:Evenement)
  <-[:PARTICIPE]-(voisin:Utilisateur)-[:PARTICIPE]->(e2:Evenement)
  WHERE NOT (me)-[:PARTICIPE]->(e2)
  RETURN e2, count(voisin) AS score ORDER BY score DESC LIMIT 5
  ```
- ⬜ 🔴 Frontoffice EvenementsPage : section "Suggestions pour vous" basée sur Neo4j
- ⬜ Enregistrer `(u)-[:A_AIDE]->(v)` quand un contrat est finalisé entre deux utilisateurs
- ⬜ `GET /api/utilisateurs/voisins-fiables` → voisins ayant le plus de contrats finalisés avec moi

### 8.2 Swipe et intérêt
- ⬜ 🟡 Enregistrer chaque swipe droite (`[:A_AIME]`) et gauche (`[:A_IGNORE]`) dans Neo4j
- ⬜ 🟡 Swipe droite = inscription automatique à l'événement (ou juste intérêt selon la logique)

### 8.3 Images dans les événements
- ⬜ 🟡 Upload photo de couverture pour un événement (Cloudinary)
- ⬜ 🟡 Afficher la photo dans les cartes événements

---

## BLOC 9 — Votes

### 9.1 Fonctionnalités manquantes
- ⬜ 🟡 Vote par quartier uniquement (seuls les habitants du quartier peuvent voter)
- ⬜ 🟡 Résultats en temps réel via Socket.io quand un vote est déposé
- ⬜ 🟡 Graphique des résultats (camembert / barres) dans la page détail du vote
- ⬜ Date de clôture automatique (fermeture auto du vote à `date_fin`)
- ⬜ Export des résultats en CSV/PDF

---

## BLOC 10 — Profil utilisateur

### 10.1 Avatar
- ⬜ 🟡 `POST /api/utilisateurs/:id/avatar` → upload photo de profil vers Cloudinary
- ⬜ 🟡 Afficher l'avatar dans la sidebar, les messages, les listes
- ⬜ 🟡 Génération automatique d'un avatar par initiales si pas de photo (déjà fait visuellement)

### 10.2 Dashboard enrichi
- ⬜ 🟡 Stats réelles sur le dashboard : nombre de services rendus, points gagnés ce mois, événements participés
- ⬜ 🟡 Graphique historique des points sur 6 mois
- ⬜ Badges / récompenses (ex: "100 pts", "5 services rendus")

### 10.3 Paramètres avancés
- ⬜ 🔴 Modification email (avec re-vérification email + MFA)
- ⬜ 🔴 Modification téléphone (avec MFA)
- ⬜ 🔴 Modification mot de passe (avec MFA)
- ⬜ Page dédiée "Sécurité" : activer/désactiver MFA, voir les sessions actives, déconnecter toutes les sessions
- ⬜ Préférences notifications (email / in-app, par type)

---

## BLOC 11 — Backoffice Admin

### 11.1 Dashboard statistiques réelles
- ✅ KPIs : nb utilisateurs, nouveaux 30j, points circulant, contrats en attente, taux complétion
- ✅ Graphiques d'activité (nouveaux utilisateurs, annonces, événements par semaine)
- ⬜ 🔴 Carte de chaleur des activités par quartier
- ⬜ Exporter les stats en CSV

### 11.2 Modération
- ⬜ 🟡 Liste des messages signalés avec actions (supprimer, avertir l'utilisateur, ignorer)
- ⬜ 🟡 Suspendre un compte temporairement (colonne `suspendu_jusqu_au`)
- ⬜ 🟡 Logs d'activité admin (qui a fait quoi, quand)
- ⬜ Gestion des litiges de contrats

### 11.3 Gestion des points
- ⬜ Créditer/débiter manuellement des points (avec motif)
- ⬜ Voir le classement des utilisateurs par points

---

## BLOC 12 — Langage d'interrogation maison (lex/yacc) 🔴 (demandé explicitement)

> "Il est demandé de créer un langage d'interrogation maison (via lex/yacc) pour manipuler les documents MongoDB"

- ✅ Définir la grammaire du langage (syntaxe inspirée SQL mais adaptée MongoDB)
  ```
  FIND annonces WHERE statut = "active" AND cout_points > 50
  FIND evenements WHERE date_debut > "2026-01-01" LIMIT 10
  INSERT annonce { titre: "Cours piano", cout_points: 30 }
  ```
- ✅ Implémenter le **lexer** (tokenisation) avec Chevrotain v10 (word boundaries)
- ✅ Implémenter le **parser** CST (arbre syntaxique concret)
- ✅ Transpiler l'AST en requêtes MongoDB Mongoose (filter, sort, limit, $and/$or/$in/$regex)
- ✅ `POST /api/query` → endpoint qui reçoit une requête et retourne les résultats + AST + durée
- ⬜ Interface dans le backoffice : console d'interrogation avec autocomplétion
- ⬜ Tests unitaires du lexer et du parser

---

## BLOC 13 — Application Java Desktop
> ✅ Déjà pris en charge par un autre membre de l'équipe. Seul point restant côté API :

---

## BLOC 14 — Tests 🔴 (demandés explicitement)

### 14.1 Tests unitaires API
- ⬜ 🔴 Setup Jest + Supertest (déjà dans `package.json`)
- ⬜ 🔴 Tests auth : register, login, refresh, logout, verify-email, reset-password, MFA
- ⬜ 🔴 Tests contrats : création, signature, finalisation, points transférés
- ⬜ 🔴 Tests quartiers : CRUD, chevauchement détecté, ray casting
- ⬜ 🔴 Tests annonces : CRUD, création contrat depuis annonce
- ⬜ 🔴 Tests points : débit/crédit corrects après finalisation contrat
- ⬜ Tests langage maison : lexer, parser, transpilation

### 14.2 Tests d'intégration
- ⬜ 🔴 Flux complet : inscription → vérification email → connexion → publication annonce → acceptation → signature double → finalisation
- ⬜ 🔴 Base de données de test isolée (variables d'env `NODE_ENV=test`)

### 14.3 Tests E2E (Playwright)
- ⬜ 🔴 Frontoffice : inscription, connexion, publier une annonce, accepter un service, signer un contrat
- ⬜ 🔴 Backoffice : connexion admin, créer un quartier sur la carte, gérer les incidents
- ⬜ 🔴 Rapport de tests HTML généré automatiquement

### 14.4 CI/CD
- ⬜ 🟡 GitHub Actions : pipeline sur chaque push → lint + tests + build Docker
- ⬜ 🟡 Badge de statut CI dans le README

---

## BLOC 15 — Qualité & UX

### 15.1 Gestion d'erreurs globale
- ⬜ 🟡 Page 404 custom dans le Frontoffice et le Backoffice
- ⬜ 🟡 ErrorBoundary React sur toutes les pages (pas d'écran blanc si une page plante)
- ⬜ 🟡 Messages d'erreur explicites sur tous les formulaires (pas juste "Erreur")
- ⬜ Toast notifications (succès/erreur) cohérents sur tout le front

### 15.2 Responsive mobile (Frontoffice)
- ⬜ 🟡 Sidebar collapsible sur mobile
- ⬜ 🟡 Toutes les pages utilisables sur smartphone (breakpoints Tailwind)
- ⬜ 🟡 La carte Leaflet utilisable sur mobile (touch events)

### 15.3 Accessibilité
- ⬜ Attributs `aria-label` sur les boutons icônes
- ⬜ Navigation clavier fonctionnelle
- ⬜ Contraste suffisant (WCAG AA)

### 15.4 Performance
- ⬜ Lazy loading des images (Cloudinary URLs avec paramètres de resize)
- ⬜ Pagination sur toutes les listes (déjà fait côté API, à vérifier côté front)
- ⬜ Debounce sur les champs de recherche

---

## BLOC 16 — Documentation 🔴 (demandée explicitement)

### 16.1 Schémas d'architecture
- ⬜ 🔴 Schéma d'architecture globale (conteneurs Docker, flux de données)
- ⬜ 🔴 Schéma de la base PostgreSQL (entités, relations)
- ⬜ 🔴 Schéma MongoDB (collections, documents types)
- ⬜ 🔴 Schéma Neo4j (nœuds, relations, propriétés)
- ⬜ 🔴 Diagramme de séquence : flux d'inscription + vérification email + MFA
- ⬜ 🔴 Diagramme de séquence : flux contrat complet (annonce → contrat → signature → finalisation)

### 16.2 Documentation API
- ✅ Swagger complet (68 endpoints, 20 schémas)
- ⬜ Ajouter les nouvelles routes (email verify, reset password, MFA, RGPD, upload media)

### 16.3 Documentation des tests
- ⬜ 🔴 Fichier `TESTS.md` : liste des cas testés, comment lancer les tests, résultats attendus

### 16.4 README principal
- ⬜ 🟡 README.md complet : présentation, stack, lancer en local, comptes de test, architecture

---

## RÉCAPITULATIF PAR PRIORITÉ

### 🔴 Critique (noté / cahier des charges strict)
1. Email : vérification inscription + reset mot de passe
2. MFA / TOTP (colonne déjà présente)
3. RGPD : export + suppression compte
4. Socket.io : messagerie temps réel + présence
5. Messagerie multimédia : photos + vocaux
6. Moteur de recommandations Neo4j
7. Langage d'interrogation maison (lex/yacc)
8. ✅ Application Java Desktop — prise en charge par l'équipe
9. Tests unitaires + intégration + E2E
10. SSO Web ↔ Java (endpoint API seulement, côté Java déjà fait)
11. Archivage contrats signés dans MongoDB + MFA à la signature
12. Schémas d'architecture documentés

### 🟡 Important (qualité de l'application)
13. Cloudinary : images annonces, événements, avatar
14. Filtres et recherche avancée annonces
15. Dashboard backoffice avec vraies stats
16. Modération (signalements, suspension)
17. Annulation de contrat + litiges
18. Responsive mobile
19. ErrorBoundary + UX cohérente

### 🟢 Bonus
20. Appels vidéo WebRTC
21. Badges / récompenses utilisateurs
22. Export résultats votes en PDF
23. CI/CD GitHub Actions

---

## ORDRE DE RÉALISATION RECOMMANDÉ

```
Semaine 1  : Bloc 1 (email + Cloudinary) + Bloc 2 (auth complète : verify, reset, MFA)
Semaine 2  : Bloc 3 (RGPD) + Bloc 4 (Socket.io temps réel) + Bloc 5 (médias messages)
Semaine 3  : Bloc 6 (annonces images/search) + Bloc 7 (contrats MongoDB + MFA) + Bloc 8 (Neo4j reco)
Semaine 4  : Bloc 12 (langage maison lex/yacc)
Semaine 5  : Bloc 14 (tests unitaires + E2E)
Semaine 6  : Bloc 16 (documentation + schémas) + polish UX
```
