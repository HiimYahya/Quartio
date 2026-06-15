# Guide de tests manuels — Quartio

Ce document liste **toutes les fonctionnalités implémentées** (✅ dans `TODO.md`) et
explique **comment les tester manuellement**, dans un **ordre logique** (de
l'inscription jusqu'aux fonctionnalités d'administration). Il complète `TESTS.md`
(tests automatisés Jest/Playwright) par une recette de test exploratoire dans le
navigateur.

> 💡 Convention : Frontoffice = `http://localhost:5173`, Backoffice =
> `http://localhost:5174`, API = `http://localhost:3000`.

---

## 0. Prérequis

```bash
cd /Users/swagreno/Desktop/Quartio
docker compose up -d
docker compose ps        # tous les services "Up" (api, frontoffice, backoffice, db, mongo, neo4j)
```

> ⚠️ Toute modification de code (`api-rest-pa/src`, `Frontoffice/src`,
> `Backoffice/src`) nécessite un rebuild : `docker compose build <service> &&
> docker compose up -d <service>` (images statiques, pas de bind-mount).

### Comptes de test

Les comptes seedés (`admin@test.com`, `jean@test.com`, `claire@test.com`) ont
`email_verifie = false` et un mot de passe inconnu → **ne pas les utiliser**. Créer
des comptes frais via `/register` (voir §1.1) — avec `SKIP_EMAIL_VERIFICATION=true`,
ces comptes sont immédiatement utilisables sans saisir de code.

### Mode test sans SMTP (`SKIP_EMAIL_VERIFICATION=true`)

`api-rest-pa/.env` contient actuellement `SKIP_EMAIL_VERIFICATION=true`
(`SMTP_USER`/`SMTP_PASS` vides) : **toute inscription est automatiquement
vérifiée** (pas de saisie de code OTP, voir §1.1). C'est temporaire — voir
`TODO_CORRECTIONS.md` pour repasser en mode normal une fois le SMTP configuré.

### Lire un code OTP / token sans boîte mail (utile seulement si
`SKIP_EMAIL_VERIFICATION=false` et SMTP non configuré)

```bash
# code de vérification email (le plus récent)
docker exec quartio_db psql -U postgres -d pa_db -c \
  "SELECT u.email, e.code, e.expire_le FROM email_verification e JOIN utilisateur u ON u.id_utilisateur = e.id_utilisateur ORDER BY e.id DESC LIMIT 3;"

# token de reset mot de passe
docker exec quartio_db psql -U postgres -d pa_db -c \
  "SELECT u.email, p.token, p.expire_le FROM password_reset p JOIN utilisateur u ON u.id_utilisateur = p.id_utilisateur ORDER BY p.id DESC LIMIT 3;"
```

### Rate limiting

`/api/auth/login` et `/api/auth/register` sont limités à 20 req / 15 min. Si "Trop de
tentatives" apparaît : `docker compose restart api`.

---

## 1. Authentification & sécurité (Frontoffice)

### 1.1 Inscription (BLOC 2.1)

#### 1.1.a Indicateur de force du mot de passe (temps réel)
1. Ouvrir `http://localhost:5173/register`, commencer à saisir le mot de passe.
2. ✅ Une barre de force (4 segments colorés, rouge → vert) + un libellé
   ("Très faible" → "Très fort") s'actualisent à chaque frappe.
3. ✅ Une checklist sous le champ devient verte item par item dès que la règle
   correspondante est respectée : 8 caractères minimum, 1 majuscule, 1 chiffre, 1
   caractère spécial.
4. **Mot de passe trop faible** (ex. `weak`) → cliquer "Sign up" → ✅ message d'erreur
   "Le mot de passe doit contenir au moins 8 caractères, 1 majuscule, 1 chiffre et 1
   caractère spécial", formulaire non soumis.
5. Saisir un mot de passe conforme, ex. `Password123!`.

#### 1.1.b Inscription avec vérification email automatique (`SKIP_EMAIL_VERIFICATION=true`)
> Mode actuel par défaut (voir §0) : pas de saisie de code OTP.
1. Remplir nom, prénom, email (ex. `test1@quartio.com`), mot de passe conforme (ex.
   `Password123!`). Valider.
2. ✅ Redirection directe vers `/login?verified=1` (pas `/verify-email`).
3. ✅ Se connecter avec ce compte → fonctionne immédiatement (pas de blocage "email
   non vérifié").
4. ✅ Dans `/profil`, le solde de points est déjà crédité de **+100** ("Points de
   bienvenue") sans avoir saisi de code.

#### 1.1.c Inscription avec vérification email par code (si `SKIP_EMAIL_VERIFICATION=false`)
> À tester uniquement après avoir repassé le flag à `false` et configuré le SMTP
> (voir `TODO_CORRECTIONS.md`).
1. Remplir le formulaire, mot de passe conforme. Valider.
2. ✅ Redirection vers `/verify-email` (pas `/login`), email cible affiché.
3. ✅ 6 inputs séparés pour le code OTP, navigation au clavier (taper un chiffre passe
   au champ suivant).
4. ✅ Un compte à rebours "Ce code expire dans 14:59" est affiché et décompte.
5. Récupérer le code via la requête SQL (§0), le saisir.
6. ✅ Redirection vers `/login` avec message de succès, et le solde de points est
   crédité de +100 (Points de bienvenue) après validation du code.
7. **Renvoi de code** : recommencer une inscription, attendre 60s sur
   `/verify-email`, vérifier que le bouton "Renvoyer un nouveau code" devient actif et
   qu'un nouveau code est généré (relancer la requête SQL).
8. **Erreur** : saisir un mauvais code → message d'erreur explicite, pas de
   redirection.

### 1.2 Connexion (BLOC 2.1 / LoginPage)
1. `/login`, se connecter avec le compte créé.
2. ✅ Redirection vers `/dashboard`.
3. **Mauvais mot de passe** : message d'erreur clair ("identifiants incorrects"),
   reste sur `/login`.
4. **Compte non vérifié** : créer un 2e compte sans vérifier l'email, tenter de se
   connecter → ✅ message "Vérifiez votre email" + lien "Renvoyer le code".

### 1.3 MFA / TOTP (BLOC 2.3)
1. Connecté, aller sur `/profil` → section Sécurité → "Activer le MFA".
2. ✅ Une modale affiche un QR code + secret + instructions.
3. Scanner avec Google Authenticator (ou utiliser le secret affiché dans une app TOTP,
   ex. extension navigateur "Authenticator").
4. Saisir le code TOTP généré → ✅ MFA activé (état affiché dans le profil).
5. Se déconnecter, se reconnecter avec ce compte.
6. ✅ Après login, redirection vers `/mfa` (pas `/dashboard`) car `mfa_required: true`.
7. Saisir le code TOTP courant → ✅ connexion finalisée, redirection `/dashboard`.
8. **Code invalide** : saisir un mauvais code sur `/mfa` → message d'erreur, reste sur
   la page.
9. **Désactivation** : `/profil` → Sécurité → "Désactiver le MFA" → demande un code
   TOTP valide → ✅ MFA désactivé, prochain login ne redemande plus `/mfa`.

> Le MFA est aussi requis avant de **signer un contrat** (§6.3) et avant les
> changements de mot de passe / email / téléphone (§2.2).

### 1.4 Mot de passe oublié (BLOC 2.2)
1. `/login` → lien "Mot de passe oublié" → `/forgot-password`.
2. Saisir un email existant → ✅ message générique de confirmation (ne révèle pas si
   le compte existe).
3. Saisir un email **inexistant** → ✅ même message générique (pas de fuite
   d'information).
4. Récupérer le token via la requête SQL `password_reset` ci-dessus.
5. Ouvrir `http://localhost:5173/reset-password/<token>`.
6. ✅ Indicateur de force du mot de passe (barre colorée + checklist) en tapant le
   nouveau mot de passe (même composant qu'en §1.1.a).
7. **Mot de passe trop faible** (ex. `azertyui`, pas de majuscule/chiffre/spécial) →
   ✅ message d'erreur "Le mot de passe doit contenir au moins 8 caractères, 1
   majuscule, 1 chiffre et 1 caractère spécial", formulaire non soumis.
8. Saisir un mot de passe conforme (ex. `Password123!`) + confirmation, valider.
9. ✅ Redirection `/login` avec message "Mot de passe mis à jour".
10. Se connecter avec le **nouveau** mot de passe → OK.
11. **Token invalide/expiré** : ouvrir `/reset-password/token-bidon` → ✅ message
    d'erreur affiché (pas de crash).
12. **Effet de bord** : après reset, tous les refresh tokens sont invalidés —
    rafraîchir une session ouverte ailleurs avec l'ancien refresh token doit échouer
    (`POST /api/auth/refresh` → 401).

### 1.5 SSO (app Java Desktop) (BLOC 2.5)
1. Connecté, ouvrir `Swagger` (`http://localhost:3000/api-docs` ou équivalent) →
   `GET /api/auth/sso-token` avec le Bearer token courant.
2. ✅ Retourne un JWT signé à courte durée (5 min), utilisable par l'app Java pour
   s'authentifier côté API.

---

## 2. Profil utilisateur (`/profil`)

### 2.1 Informations générales (BLOC 10)
1. Modifier nom/prénom/email basique → ✅ sauvegarde immédiate, affichage mis à jour.
2. Vérifier l'affichage : solde de points, rôle, historique des transactions de
   points (la transaction "Points de bienvenue" +100 doit apparaître après
   vérification de l'email, §1.1).
3. Détecter son quartier par adresse (champ adresse → bouton de détection) → ✅
   quartier affecté et affiché (relation Neo4j `[:HABITE]` créée — vérifiable plus
   tard sur la carte du quartier correspondant, §3).
4. Switcher la langue (sélecteur FR/EN en bas de sidebar) → ✅ l'UI change de langue
   immédiatement (i18next).

### 2.2 Section Sécurité (BLOC 10.3)
Pour chaque action ci-dessous, si le MFA est actif un code TOTP est demandé en plus.
1. **Changer le mot de passe** : mdp actuel + nouveau + confirmation → ✅ succès,
   reconnexion possible avec le nouveau mdp.
   - ✅ Même indicateur de force / checklist qu'en §1.1.a sous le champ "Nouveau mot
     de passe".
   - **Nouveau mot de passe trop faible** → ✅ message d'erreur "Le mot de passe doit
     contenir au moins 8 caractères, 1 majuscule, 1 chiffre et 1 caractère spécial",
     formulaire non soumis.
2. **Changer l'email** : nouvel email → ✅ déclenche une re-vérification (recevoir un
   nouveau code OTP sur le nouvel email, comme en §1.1).
3. **Changer le téléphone** → ✅ succès (+ MFA si actif).
4. **Sessions actives** : ouvrir la même session sur 2 navigateurs (ou navigation
   privée), `/profil` → Sécurité → "Sessions actives" → ✅ liste avec ≥ 2 entrées.
5. **Déconnecter partout** → ✅ toutes les sessions sont révoquées ; l'autre
   navigateur est déconnecté au prochain appel API (refresh token invalide).

### 2.3 RGPD (BLOC 3.1)
1. `/profil` → section "Mes données (RGPD)" → "Exporter mes données".
2. ✅ Télécharge un JSON contenant : profil, annonces, messages, contrats, votes,
   transactions, notifications, relations Neo4j.
3. **Suppression de compte** (sur un compte jetable, pas le compte principal de test) :
   bouton "Supprimer mon compte" → confirmation → code MFA (ou mot de passe si MFA
   inactif) → ✅ compte supprimé, déconnexion automatique, login impossible ensuite.
4. ✅ Vérifier que dans une conversation où ce compte avait écrit, ses anciens
   messages affichent "[Message supprimé]" (anonymisation, BLOC 3.3) au lieu d'être
   effacés.

---

## 3. Carte du quartier (`/carte`)

1. ✅ La carte affiche les polygones des quartiers (Leaflet) + marqueurs annonces et
   événements.
2. Utiliser les filtres de couches (tout / annonces / événements) → ✅ les marqueurs
   apparaissent/disparaissent en conséquence.
3. Cliquer un quartier sur la carte (ou dans une liste) → ✅ `flyTo` (zoom/centrage
   animé) + la carte montre les annonces/événements de ce quartier uniquement.

---

## 4. Annonces (`/annonces`)

### 4.1 Création et consultation
1. `/annonces` → formulaire de création : titre, description, type (offre/demande),
   catégorie, payant (oui/non) + coût en points, quartier.
2. ✅ L'annonce apparaît dans la liste (carte avec titre/type/prix).
3. Cliquer l'annonce → `/annonces/:id` → ✅ titre, description, type, prix affichés.
4. **Propriétaire** : ouvrir sa propre annonce → ✅ message indiquant que c'est sa
   propre annonce (pas de bouton "Accepter").

### 4.2 Accepter un service (création de contrat)
> Nécessite 2 comptes : un **vendeur** (auteur de l'annonce payante) et un
> **acheteur**.
1. Avec le compte acheteur (≠ auteur), ouvrir une annonce payante (`est_payant=true`,
   `cout_points > 0`).
2. Vérifier que le solde de points de l'acheteur est suffisant (sinon message d'erreur
   "Points insuffisants").
3. Cliquer "Accepter ce service" → ✅ un contrat est créé (`POST
   /api/annonces/:id/contrat`) et redirige vers `/contrats/:id`.
4. **Cas refus** : l'auteur de l'annonce tente d'accepter sa propre annonce → ✅
   refusé (409).
5. **Contacter le voisin** : bouton "Contacter le voisin" depuis la page détail → ✅
   ouvre/crée une conversation avec le vendeur (§6 Messagerie).

---

## 5. Contrats & signatures (`/contrats`, `/contrats/:id`)

### 5.1 Liste des contrats
1. `/contrats` → ✅ liste triée avec les contrats "en attente" en priorité, badge "À
   signer →" et statut coloré par carte.

### 5.2 Flux de signature simple (sans PDF)
1. Ouvrir un contrat `en_attente` en tant que partie concernée (vendeur ou acheteur).
2. ✅ Étape 1 "Informations" : points échangés, dates, bloc participants
   (vendeur/acheteur) avec état de chaque signature (signé / en attente).
3. Cliquer "Continuer →" → étape 2 "Document PDF (optionnel)".
4. Cliquer "Passer cette étape →" (pas de PDF) → étape 3 "Signature".
5. Dessiner une signature dans le canvas → le bouton "✍️ Signer" devient actif.
6. Cliquer "Signer" → ✅ appel `PUT /api/contrats/:id/signer`, rechargement de la
   page, l'état de signature de cette partie passe à "signé".
7. Avec le 2e compte (l'autre partie), signer également → ✅ à la 2e signature : le
   contrat passe à `termine`/`finalise`, les points sont transférés (vérifier le
   solde de points des 2 comptes dans `/profil`), et l'annonce associée est archivée
   (visible côté Backoffice AnnoncesPage, statut "archivée").

### 5.3 Flux avec PDF + zones de signature/initiales (GAP 2)
1. Reprendre le flux ci-dessus, mais à l'étape 2 **importer un PDF** (clic sur la zone
   d'upload, sélectionner un fichier `.pdf`).
2. ✅ Dès l'upload, passage automatique à l'étape 3 (le nombre de pages du PDF est
   calculé).
3. Dans le bloc **"Emplacement de la signature dans le document"** :
   - Sélecteur **"Page"** → ✅ liste `Page 1 … Page N` (N = nb réel de pages du PDF
     importé), la dernière page est annotée "(dernière)" et sélectionnée par défaut.
   - Sélecteur **"Position"** → ✅ 4 choix : Bas droite / Bas gauche / Haut droite /
     Haut gauche.
4. Cocher **"Ajouter mes initiales en bas de chaque page (N pages)"** → ✅ un second
   canvas "Paraphe (2-3 lettres)" apparaît, avec un bouton "Effacer".
5. Dessiner la signature principale (grand canvas) **et** le paraphe (petit canvas).
6. Cliquer "✍️ Signer et télécharger le PDF" → ✅ :
   - Un PDF est téléchargé automatiquement (`contrat_<id>_signe.pdf`).
   - Ouvrir le PDF téléchargé : la signature apparaît sur la page et au coin
     sélectionnés à l'étape 3, avec une ligne de signature et le texte "Signé par :
     Prénom Nom — JJ/MM/AAAA".
   - Le paraphe apparaît centré en bas de **chaque page** du PDF.
7. **Décalage anti-collision** : si l'autre partie a déjà signé au même endroit, signer
   à son tour avec la même page/position → ✅ la 2e signature est décalée
   verticalement (pas de superposition).
8. **Sans cocher "initiales"** → ✅ le paraphe n'apparaît sur aucune page, seule la
   signature complète est présente.

### 5.4 MFA requis avant signature (BLOC 2.3 / 7.3)
1. Sur un compte avec MFA activé (§1.3), arriver à l'étape 3 et cliquer "Signer".
2. ✅ Une modale demande un code TOTP avant de signer (au lieu de signer
   immédiatement).
3. Saisir le code → ✅ signature effectuée (vérifié côté `PUT
   /api/contrats/:id/signer` qui valide le code).
4. Code invalide → ✅ message d'erreur, signature non effectuée.

### 5.5 Document archivé + hash (GAP 5 / BLOC 7.1)
1. Une fois le contrat `finalise` (les 2 parties ont signé), recharger
   `/contrats/:id`.
2. ✅ Bouton "Télécharger le contrat signé" visible.
3. ✅ Hash SHA-256 du document affiché (preuve d'intégrité).
4. Cliquer le bouton → ✅ télécharge le PDF archivé depuis MongoDB (`GET
   /api/contrats/:id/document`), contenant les **2** signatures (et initiales si
   ajoutées par les 2 parties).

---

## 6. Messagerie (`/messages`, `/messages/:id`)

### 6.1 Liste des conversations
1. `/messages` → ✅ liste des conversations, chacune affichant : dernier message
   (tronqué), timestamp relatif ("il y a 5 min"), badge nombre de messages non lus,
   indicateur online/offline de l'interlocuteur (point vert/gris).

### 6.2 Conversation — texte + temps réel
> Ouvrir 2 navigateurs (ou 1 normal + 1 navigation privée), connectés avec les 2
> comptes participant à la conversation.
1. Navigateur A : ouvrir `/messages/:id`, envoyer un message texte.
2. ✅ Navigateur B (même conversation ouverte) reçoit le message **instantanément**
   sans recharger (Socket.io `message:new`).
3. ✅ En haut de la conversation, la présence online/offline de l'interlocuteur est à
   jour (passe "offline" si B ferme l'onglet).
4. **Indicateur de frappe** : A commence à taper → ✅ B voit un indicateur "en train
   d'écrire…".

### 6.3 Envoi d'images (BLOC 5.1)
1. Dans la conversation, cliquer le bouton 📎 → sélectionner une image (jpg/png).
2. ✅ L'image est uploadée (Cloudinary) et affichée inline dans la conversation pour
   les 2 participants (temps réel via `message:new`).

### 6.4 Signalement de message (modération, GAP 1)
1. Survoler un message reçu → ✅ icône "Signaler ce message" apparaît.
2. Cliquer, confirmer le signalement → ✅ requête `POST
   /api/conversations/.../signaler` (ou équivalent) envoyée avec succès.
3. Vérifier côté Backoffice (§9.6 SignalementsPage) que ce signalement apparaît dans
   la liste.

---

## 7. Événements (`/evenements`, `/evenements/:id`)

### 7.1 Liste, création, swipe
1. `/evenements` → ✅ liste de cartes + vue "swipe" (react-tinder-card).
2. Créer un événement (titre, description, dates, lieu, quartier).
3. En vue swipe : swiper une carte à **droite** → ✅ enregistre `[:A_AIME]` dans
   Neo4j ; à **gauche** → `[:A_IGNORE]`.

### 7.2 Suggestions (Neo4j, BLOC 8.1)
1. Après avoir participé à plusieurs événements avec un autre compte qui partage des
   participations (ou après plusieurs swipes droite), recharger `/evenements`.
2. ✅ Une section "✨ Suggestions pour vous" apparaît, basée sur la requête Cypher de
   recommandation (événements auxquels des "voisins" similaires participent).

### 7.3 Détail + participation
1. `/evenements/:id` → ✅ titre, description, dates, lieu affichés.
2. Cliquer "S'inscrire" → ✅ `POST /api/evenements/:id/participer`, le bouton devient
   "Se désinscrire".
3. Cliquer "Se désinscrire" → ✅ `DELETE /api/evenements/:id/participer`, retour à
   l'état initial.

---

## 8. Votes (`/votes`) — GAP 3 paramétrable

### 8.1 Vote "choix multiple" (par défaut)
1. Créer un vote sans préciser de `type_vote` (ou `choix_multiple`), avec plusieurs
   options.
2. ✅ Apparaît dans `/votes` avec ses options.
3. Voter pour une option (inline) → ✅ vote enregistré (`POST /api/votes/:id/voter`).
4. Tenter de revoter avec le même compte → vérifier le comportement attendu
   (remplacement ou refus selon implémentation).

### 8.2 Vote "oui/non"
1. Créer un vote avec `type_vote = oui_non` (depuis Backoffice si pas exposé en
   Frontoffice — voir §9.5).
2. ✅ Les options "Oui" / "Non" sont générées **automatiquement** côté backend (pas
   besoin de les saisir).
3. Voter → ✅ fonctionne comme un vote à choix multiple à 2 options.

### 8.3 Vote "classement"
1. Créer un vote avec `type_vote = classement` et plusieurs options.
2. ✅ Sur la page de vote, une UI ↑/↓ permet de réordonner les options avant de
   soumettre le classement.
3. Soumettre → ✅ le classement est enregistré (`POST /api/votes/:id/voter` avec
   l'ordre choisi).

---

## 9. Incidents (`/incidents`)

1. `/incidents` → ✅ liste avec statut et priorité colorés.
2. Créer un incident (titre, description, type, priorité).
3. ✅ Apparaît dans la liste avec la bonne couleur de priorité.
4. **Alerte temps réel (GAP 4)** : créer un incident avec priorité **haute** ou
   **critique** depuis un compte, pendant qu'un autre compte est connecté ailleurs →
   ✅ ce 2e compte reçoit un événement Socket.io `alert:incident` (broadcast à tous
   les connectés — vérifiable via la console réseau/WS du navigateur, onglet
   "Messages" des DevTools sur la connexion WebSocket).

---

## 10. Alertes temps réel — récapitulatif (GAP 4)

À vérifier via l'onglet WebSocket des DevTools (Network → WS → frames) pendant que
les actions ci-dessous sont déclenchées par un autre utilisateur connecté :

| Événement | Déclencheur | Portée |
|---|---|---|
| `alert:incident` | Incident créé avec priorité haute/critique (§9) | broadcast à tous |
| `alert:contrat` | Contrat passe "en attente de signature" (§5) | ciblé au destinataire |
| `alert:vote` | Nouveau vote créé (§8) | broadcast à tous |

---

## 11. Backoffice (`http://localhost:5174`)

### 11.1 Connexion (BLOC 0 / GAP 1)
1. `/login` (backoffice) avec un compte `role = admin`.
2. ✅ Connexion réussie → `/dashboard`. Un compte `role = user` est **refusé** (403
   ou redirection).
3. ✅ Si MFA actif sur le compte admin → écran de saisie TOTP avant accès.
4. **Rôle modérateur (GAP 1)** : créer/promouvoir un compte en `moderateur` (via
   UtilisateursPage admin, §11.3), se connecter avec ce compte au backoffice.
   - ✅ Connexion acceptée.
   - ✅ La sidebar n'affiche que : Incidents, Signalements, Annonces (sections
     filtrées par rôle).
   - Tenter d'accéder directement à `/quartiers` ou `/utilisateurs` en tapant l'URL →
     vérifier que l'accès est refusé/limité (pages réservées admin).

### 11.2 Dashboard
1. ✅ Compteurs : utilisateurs, incidents, votes, annonces, événements.
2. ✅ État des services (API, MongoDB, PostgreSQL, Neo4j) — doivent tous être "OK"
   (vert) si `docker compose ps` montre tout "Up".
3. ✅ Graphiques d'activité (nouveaux users / annonces / points échangés par semaine,
   8 semaines) — alimentés par les actions effectuées dans les sections précédentes.
4. ✅ Incidents urgents (critique/haute, §9) mis en avant avec badge rouge.

### 11.3 Utilisateurs
1. `/utilisateurs` → ✅ liste avec recherche texte et filtre par rôle.
2. Changer le rôle d'un utilisateur via le dropdown inline → ✅ persisté (recharger
   la page pour confirmer).
3. Créer un utilisateur via la modale (prénom, nom, email, mdp, rôle, langue) → ✅
   apparaît dans la liste.
4. Supprimer un utilisateur (jetable) via la modale de confirmation → ✅ disparaît de
   la liste.

### 11.4 Quartiers
1. `/quartiers` → ✅ liste + carte interactive.
2. Créer un quartier : dessiner un polygone sur la carte (clics successifs, double-clic
   pour fermer la zone) → enregistrer.
3. **Chevauchement** : dessiner un polygone qui chevauche un quartier existant → ✅
   erreur de chevauchement (frontend + backend, Turf.js).
4. Sélectionner un quartier dans la liste → ✅ highlight sur la carte.
5. **Édition** : modifier un point du polygone (glisser un sommet), `Backspace`
   annule le dernier point en cours de dessin, `Escape` annule le dessin.
6. Supprimer un quartier (modale de confirmation par-dessus la carte) → ✅ disparaît
   de la carte et de la liste.

### 11.5 Annonces / Événements / Votes / Incidents (CRUD admin)
Pour chacune de ces pages (`/annonces`, `/evenements`, `/votes`, `/incidents` côté
backoffice) :
1. ✅ Liste avec filtres par statut.
2. Changer le statut inline (ex. annonce active → archivée, incident ouvert → en
   cours) → ✅ persisté.
3. Créer un élément via la modale dédiée → ✅ apparaît dans la liste.
4. Supprimer (avec modale de confirmation) → ✅ disparaît.
5. Pour les **annonces** : vérifier qu'une annonce devenue "archivée" suite à la
   finalisation d'un contrat (§5.2) apparaît bien avec ce statut ici.

### 11.6 Contrats (admin)
1. `/contrats` (backoffice) → ✅ liste, changement de statut inline.
2. Pour un contrat `signe`/`termine`, bouton "Document" → ✅ ouvre le PDF archivé
   (URL Cloudinary ou PDF base64) — doit correspondre au PDF téléchargé en §5.5.
3. Supprimer un contrat (jetable) avec modale → ✅ disparaît.

### 11.7 Signalements (modération, BLOC 11.2)
1. `/signalements` → ✅ liste des messages signalés (§6.4) : auteur, contenu, date,
   motif.
2. Pour un signalement :
   - "Supprimer le message" → ✅ le message disparaît de la conversation côté
     Frontoffice (remplacé par "[Message supprimé]" ou retiré selon implémentation).
   - "Avertir l'utilisateur" → ✅ requête envoyée avec succès (`POST
     /api/messages/:id/avertir`).
   - "Ignorer le signalement" → ✅ le signalement disparaît de la liste sans action
     sur le message.
3. **Avec un compte modérateur** : ✅ ces 3 actions sont accessibles (middleware
   `role('admin','moderateur')`).

### 11.8 Statistiques (`/statistiques`)
1. ✅ Graphiques sur 8 semaines : inscriptions, annonces, événements, points échangés.
2. ✅ Classement des utilisateurs par points (top 10).
3. ✅ Camembert "Services les plus demandés" (top catégories d'annonces).
4. ✅ Carte de chaleur (heatmap) des quartiers (BLOC 11.1) : polygones colorés
   bleu→rouge selon le score d'activité (habitants + annonces + événements +
   incidents sur 30 jours), tooltip au survol.

### 11.9 Console Quartio-QL (`/console`, BLOC 12)
> Langage d'interrogation maison (lexer/parser Chevrotain → requêtes Mongoose).
1. Ouvrir `/console`. ✅ Éditeur de requêtes avec thème sombre, `Ctrl+Entrée` pour
   exécuter, `Tab` pour l'indentation, boutons "exemples rapides" et aide syntaxe.
2. Tester chaque exemple rapide proposé, notamment :
   - `FIND annonces WHERE statut = "active" LIMIT 20` → ✅ tableau JSON de résultats +
     vue AST.
   - `COUNT incidents WHERE statut = "ouvert"` → ✅ retourne un nombre.
   - `FIND incidents WHERE titre CONTAINS "bruit"` → ✅ `$regex` insensible à la casse.
   - `FIND annonces WHERE statut IN ("active", "inactive") LIMIT 30` → ✅ `$in`.
   - `FIND annonces WHERE est_payant = true AND cout_points > 50 LIMIT 20` → ✅
     combinaison AND + opérateur numérique.
   - `UPDATE annonces WHERE statut = "inactive" SET { "statut": "archivee" }` → ✅
     met à jour les documents correspondants (vérifier ensuite avec un `FIND`).
3. Tester une requête invalide (ex. `DELETE annonces` sans `WHERE`) → ✅ erreur de
   syntaxe explicite affichée (pas de crash de la console).
4. ✅ Chaque exécution affiche la durée et l'AST de la requête.

---

## 12. Tests automatisés (rappel — voir `TESTS.md` pour le détail)

Une fois la recette manuelle ci-dessus passée, relancer la suite automatisée pour
détecter les régressions :

```bash
# Backend (89 tests, 6 suites) — nécessite pa_db_test (voir TESTS.md §1.1)
cd api-rest-pa && npm test

# E2E Playwright (5 tests : frontoffice + backoffice)
cd e2e && npx playwright test
```

---

## Ordre de passage recommandé (synthèse)

```
1. Inscription : indicateur de force du mot de passe + vérification email auto (§1.1)
2. Connexion + MFA (§1.2-1.3)
3. Mot de passe oublié (§1.4)
4. Profil : sécurité + RGPD (§2)
5. Carte (§3)
6. Annonces : création + acceptation → contrat (§4)
7. Contrats : signature simple, puis avec PDF + GAP2, MFA, document archivé (§5)
8. Messagerie : texte temps réel, images, signalement (§6)
9. Événements : CRUD, swipe, suggestions, participation (§7)
10. Votes : 3 types (§8)
11. Incidents + alertes temps réel (§9-10)
12. Backoffice : login admin/modérateur → dashboard → utilisateurs → quartiers
    → CRUD annonces/événements/votes/incidents/contrats → signalements
    → statistiques → console Quartio-QL (§11)
13. Suites automatisées (§12)
```
