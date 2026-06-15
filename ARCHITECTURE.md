# Architecture — Quartio

Ce document regroupe les schémas d'architecture et diagrammes de séquence du projet
(BLOC 16.1). Les diagrammes sont au format [Mermaid](https://mermaid.js.org/), affichés
nativement par GitHub/GitLab.

---

## 1. Architecture globale (conteneurs Docker, flux de données)

```mermaid
graph TB
    subgraph "Navigateur"
        U[Utilisateur]
        A[Administrateur]
    end

    subgraph "Docker — quartio_*"
        FO["Frontoffice (nginx :5173)<br/>React + Vite"]
        BO["Backoffice (nginx :5174)<br/>React + Vite"]
        API["API (node :3000)<br/>Express + Socket.io"]
        PG[("PostgreSQL :5432<br/>pa_db")]
        MG[("MongoDB :27017<br/>pa_db")]
        N4[("Neo4j :7474/7687<br/>graphe relationnel")]
    end

    EXT["Services externes<br/>(Cloudinary, SMTP, Nominatim)"]

    U -->|HTTP| FO
    A -->|HTTP| BO
    FO -->|REST + WebSocket /api| API
    BO -->|REST + WebSocket /api| API

    API -->|"utilisateurs, quartiers, contrats,<br/>transactions, votes (ACID)"| PG
    API -->|"annonces, événements, incidents,<br/>messages, documents contrat"| MG
    API -->|"relations sociales : HABITE, SIGNE,<br/>PARTICIPE, CREE, REPOND…"| N4
    API -->|upload médias / emails / géocodage| EXT
```

| Service | Rôle | Port exposé |
|---|---|---|
| `frontoffice` | App React utilisateurs (build statique servi par nginx) | 5173 |
| `backoffice` | App React admin (build statique servi par nginx) | 5174 |
| `api` | API REST + Socket.io (Express, Node 20) | 3000 |
| `db` | PostgreSQL 16 — données transactionnelles (ACID) | 5432 |
| `mongo` | MongoDB 7 — documents riches (annonces, messages…) | 27017 |
| `neo4j` | Neo4j 5 — graphe des relations entre entités | 7474 / 7687 |

Chaque image est buildée de façon statique (pas de bind-mount du code source) : toute
modification de `api-rest-pa/src`, `Frontoffice/src` ou `Backoffice/src` nécessite
`docker compose build <service> && docker compose up -d <service>`.

---

## 2. Schéma de la base PostgreSQL (entités, relations)

PostgreSQL porte les données nécessitant des garanties **ACID** : comptes utilisateurs,
authentification, contrats, transactions de points et votes.

```mermaid
erDiagram
    UTILISATEUR {
        int id_utilisateur PK
        varchar nom
        varchar prenom
        varchar email
        varchar telephone
        varchar role "user | admin | moderateur"
        varchar mot_de_passe
        int points_solde
        varchar langue
        timestamp date_inscription
        varchar mfa_secret
        boolean mfa_actif
        boolean email_verifie
    }

    QUARTIER {
        int id_quartier PK
        varchar nom
        text geometrie "GeoJSON"
        timestamp date_creation
    }

    CONTRAT {
        int id_contrat PK
        int id_vendeur FK
        int id_acheteur FK
        varchar id_annonce_mongo "réf. Mongo Annonce"
        int points_echanges
        varchar statut "en_attente | signe | annule | termine"
        boolean signe_vendeur
        boolean signe_acheteur
        timestamp date_creation
        timestamp date_signature
    }

    TRANSACTION_POINTS {
        int id_transaction PK
        int montant
        text motif
        timestamp date
    }

    VOTE {
        int id_vote PK
        varchar titre
        text description
        varchar type
        varchar type_vote "choix_multiple | oui_non | classement"
        int nb_choix_max
        timestamp date_debut
        timestamp date_fin
        boolean est_anonyme
        varchar statut "ouvert | ferme | archive"
    }

    OPTION_VOTE {
        int id_option PK
        int id_vote FK
        varchar libelle
        int ordre
    }

    THEME {
        int id_theme PK
        varchar titre
        text caracteristique
    }

    REFRESH_TOKEN {
        int id_token PK
        int id_utilisateur FK
        varchar token
        timestamp expire_le
        boolean est_revoque
    }

    EMAIL_VERIFICATION {
        int id PK
        int id_utilisateur FK
        varchar code "OTP 6 chiffres"
        timestamp expire_le
        boolean utilise
    }

    PASSWORD_RESET {
        int id PK
        int id_utilisateur FK
        varchar token
        timestamp expire_le
        boolean utilise
    }

    NOTIFICATION {
        int id_notification PK
        int id_utilisateur FK
        varchar type "message|evenement|contrat|vote|incident|systeme"
        varchar titre
        text contenu
        varchar id_ressource "id PG ou ObjectId Mongo"
        varchar type_ressource
        boolean est_lue
    }

    UTILISATEUR ||--o{ REFRESH_TOKEN : "possède"
    UTILISATEUR ||--o{ EMAIL_VERIFICATION : "demande"
    UTILISATEUR ||--o{ PASSWORD_RESET : "demande"
    UTILISATEUR ||--o{ NOTIFICATION : "reçoit"
    UTILISATEUR ||--o{ CONTRAT : "vend (id_vendeur)"
    UTILISATEUR ||--o{ CONTRAT : "achète (id_acheteur)"
    VOTE ||--o{ OPTION_VOTE : "propose"
```

> Les liens `quartier ↔ utilisateur/annonce/événement`, `vote ↔ theme/utilisateur`,
> `transaction_points ↔ utilisateur/contrat` ne sont **pas** des clés étrangères
> PostgreSQL : ils sont matérialisés dans **Neo4j** (voir section 4) pour permettre des
> requêtes de graphe (ex. "quels voisins ont aidé tel utilisateur ?").

---

## 3. Schéma MongoDB (collections, documents types)

MongoDB porte les **documents riches et semi-structurés** : annonces, événements,
incidents, conversations/messages et l'archive des contrats signés. Chaque document
référence son auteur PostgreSQL via `id_utilisateur_pg`.

```mermaid
graph LR
    subgraph "Collection: annonces"
        AN["{ titre, description, type,<br/>est_payant, cout_points,<br/>categorie, type_concerne,<br/>statut: active|inactive|archivee,<br/>date_publication,<br/>id_utilisateur_pg }"]
    end

    subgraph "Collection: evenements"
        EV["{ titre, description, type,<br/>date_debut, date_fin, lieu,<br/>capacite_max,<br/>statut: planifie|en_cours|termine|annule,<br/>medias: [{url, type}],<br/>id_utilisateur_pg }"]
    end

    subgraph "Collection: incidents"
        IN["{ titre, description, type,<br/>statut: ouvert|en_cours|resolu|ferme,<br/>priorite: basse|normale|haute|critique,<br/>date_signalement, date_resolution,<br/>est_synchronise,<br/>id_utilisateur_pg,<br/>id_message → Message }"]
    end

    subgraph "Collection: conversations"
        CV["{ type: privee|groupe|publique,<br/>nom,<br/>participants_pg: [id...] }"]
    end

    subgraph "Collection: messages"
        MS["{ type: texte|image|video|fichier,<br/>contenu, media_url, date_envoi,<br/>est_supprime, lu_par: [id...],<br/>id_utilisateur_pg,<br/>id_conversation → Conversation }"]
    end

    subgraph "Collection: contratdocuments"
        CD["{ id_contrat_pg (unique),<br/>pdf_url, pdf_base64, hash_sha256,<br/>signatures: [{ id_utilisateur_pg,<br/>nom, prenom, dataurl, signed_at, ip }] }"]
    end

    MS -->|id_conversation| CV
    IN -->|id_message| MS
    CD -.->|id_contrat_pg| PG[("PostgreSQL: contrat")]
    AN -.->|id_utilisateur_pg| PGU[("PostgreSQL: utilisateur")]
    EV -.->|id_utilisateur_pg| PGU
    IN -.->|id_utilisateur_pg| PGU
    CV -.->|participants_pg| PGU
    MS -.->|id_utilisateur_pg| PGU
    CD -.->|signatures.id_utilisateur_pg| PGU
```

Toutes les collections incluent `createdAt`/`updatedAt` (option `timestamps: true` de
Mongoose). Les liens en pointillés (`-.->`) sont des références applicatives vers
PostgreSQL (pas de contrainte au niveau base).

---

## 4. Schéma Neo4j (nœuds, relations, propriétés)

Neo4j matérialise les **relations** entre entités gérées par PostgreSQL et MongoDB —
chaque nœud porte uniquement un identifiant de référence (`pg_id` ou `mongo_id`), les
données métier restant dans leur base d'origine.

```mermaid
graph LR
    Utilisateur(("Utilisateur<br/>{pg_id}"))
    Quartier(("Quartier<br/>{pg_id}"))
    Contrat(("Contrat<br/>{pg_id}"))
    Transaction(("Transaction<br/>{pg_id}"))
    Vote(("Vote<br/>{pg_id}"))
    OptionVote(("OptionVote<br/>{pg_id}"))
    Theme(("Theme<br/>{pg_id}"))
    Annonce(("Annonce<br/>{mongo_id}"))
    Evenement(("Evenement<br/>{mongo_id}"))
    Conversation(("Conversation<br/>{mongo_id}"))
    Message(("Message<br/>{mongo_id}"))
    Incident(("Incident<br/>{mongo_id}"))

    Utilisateur -- HABITE --> Quartier
    Utilisateur -- A_AIDE --- Utilisateur
    Utilisateur -- CREE --> Vote
    Utilisateur -- REPOND --> OptionVote
    Utilisateur -- ORGANISE --> Evenement
    Utilisateur -- PARTICIPE --> Evenement
    Utilisateur -- SIGNE --> Contrat
    Utilisateur -- ENVOIE --> Message
    Utilisateur -- UTILISE --> Conversation

    Annonce -- APPARTIENT --> Quartier
    Annonce -- GENERE --> Contrat
    Evenement -- TIENT_DANS --> Quartier
    Vote -- COMPOSE --> Theme
    Vote -- A_OPTION --> OptionVote
    Message -- CONTENU_DANS --> Conversation
    Message -- SIGNALE --> Incident
    Contrat -- LIE_A --> Transaction
    Transaction -- EST_POUR --> Utilisateur
```

| Relation | De → Vers | Signification |
|---|---|---|
| `HABITE` | Utilisateur → Quartier | rattachement géographique (détection par adresse / ray casting) |
| `A_AIDE` | Utilisateur — Utilisateur | un voisin a rendu un service à un autre (créé à la finalisation d'un contrat de service) |
| `CREE` | Utilisateur → Vote | auteur d'un vote |
| `REPOND` | Utilisateur → OptionVote | vote exprimé (propriété `date_vote`) |
| `ORGANISE` | Utilisateur → Evenement | organisateur d'un événement |
| `PARTICIPE` | Utilisateur → Evenement | inscription à un événement |
| `SIGNE` | Utilisateur → Contrat | signature acheteur/vendeur |
| `ENVOIE` | Utilisateur → Message | auteur d'un message |
| `UTILISE` | Utilisateur → Conversation | participant à une conversation |
| `APPARTIENT` | Annonce → Quartier | quartier de rattachement de l'annonce |
| `GENERE` | Annonce → Contrat | contrat créé depuis une annonce |
| `TIENT_DANS` | Evenement → Quartier | quartier où se déroule l'événement |
| `COMPOSE` | Vote → Theme | thème associé au vote |
| `A_OPTION` | Vote → OptionVote | options proposées par le vote |
| `CONTENU_DANS` | Message → Conversation | rattachement du message à la conversation |
| `SIGNALE` | Message → Incident | message à l'origine du signalement d'incident |
| `LIE_A` | Contrat → Transaction | transactions de points générées par le contrat |
| `EST_POUR` | Transaction → Utilisateur | bénéficiaire/débiteur de la transaction |

---

## 5. Diagramme de séquence — Inscription + vérification email + MFA

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant FO as Frontoffice
    participant API as API
    participant PG as PostgreSQL
    participant Mail as SMTP

    U->>FO: Remplit le formulaire d'inscription
    FO->>API: POST /api/auth/register
    API->>PG: INSERT utilisateur (mot_de_passe hashé, email_verifie=false)
    API->>PG: INSERT email_verification (code OTP 6 chiffres, expire 15min)
    API->>Mail: Envoi email "Vérifiez votre compte" (code OTP)
    API-->>FO: 201 Created

    U->>FO: Saisit le code reçu par email
    FO->>API: POST /api/auth/verify-email { email, code }
    API->>PG: SELECT email_verification (code valide, non expiré, non utilisé)
    alt code invalide / expiré
        API-->>FO: 400 Code invalide ou expiré
    else code valide
        API->>PG: UPDATE utilisateur SET email_verifie=true, points_solde += 100
        API->>PG: INSERT transaction_points (+100, "Points de bienvenue")
        API->>PG: UPDATE email_verification SET utilise=true
        API-->>FO: 200 OK
    end

    U->>FO: Saisit email + mot de passe
    FO->>API: POST /api/auth/login
    API->>PG: SELECT utilisateur WHERE email
    alt email non vérifié
        API-->>FO: 403 email_verification_required
    else MFA actif
        API-->>FO: 200 { mfa_required: true, mfa_token (10 min) }
        U->>FO: Saisit le code TOTP (app Authenticator)
        FO->>API: POST /api/auth/mfa/verify { mfa_token, code }
        API->>API: Vérifie le code TOTP (speakeasy, secret = utilisateur.mfa_secret)
        alt code invalide
            API-->>FO: 401 Code MFA invalide
        else code valide
            API-->>FO: 200 { access_token, refresh_token }
        end
    else MFA inactif
        API-->>FO: 200 { access_token, refresh_token }
    end
```

---

## 6. Diagramme de séquence — Flux contrat complet (annonce → contrat → signature → finalisation)

```mermaid
sequenceDiagram
    actor V as Vendeur
    actor Ac as Acheteur
    participant FO as Frontoffice
    participant API as API
    participant PG as PostgreSQL
    participant MG as MongoDB
    participant N4 as Neo4j

    V->>FO: Publie une annonce (payante, cout_points)
    FO->>API: POST /api/annonces
    API->>MG: INSERT annonce (statut=active, id_utilisateur_pg=V)
    API->>N4: MERGE (Annonce)-[:APPARTIENT]->(Quartier)

    Ac->>FO: Accepte l'annonce / le service
    FO->>API: POST /api/contrats { id_annonce, id_vendeur, id_acheteur, points_echanges }
    API->>PG: INSERT contrat (statut='en_attente', signe_vendeur=false, signe_acheteur=false)
    API->>N4: MERGE (Annonce)-[:GENERE]->(Contrat)

    Ac->>FO: Signe le contrat (canvas de signature)
    FO->>API: POST /api/contrats/:id/signer (+ code MFA si activé)
    API->>PG: UPDATE contrat SET signe_acheteur=true, statut='signe'
    API->>MG: UPSERT contratdocument.signatures += signature acheteur
    API->>N4: MERGE (Acheteur)-[:SIGNE]->(Contrat)

    V->>FO: Signe le contrat à son tour
    FO->>API: POST /api/contrats/:id/signer (+ code MFA si activé)
    API->>PG: UPDATE contrat SET signe_vendeur=true
    API->>MG: UPSERT contratdocument.signatures += signature vendeur
    API->>N4: MERGE (Vendeur)-[:SIGNE]->(Contrat)

    Note over API,PG: Les deux parties ont signé → finalisation

    API->>PG: UPDATE utilisateur (acheteur) points_solde -= points_echanges
    API->>PG: UPDATE utilisateur (vendeur) points_solde += points_echanges
    API->>PG: INSERT transaction_points (débit acheteur, crédit vendeur)
    API->>N4: MERGE (Transaction)-[:EST_POUR]->(Utilisateur)
    API->>N4: MERGE (Contrat)-[:LIE_A]->(Transaction)
    API->>N4: MERGE (Vendeur)-[:A_AIDE]->(Acheteur)
    API->>PG: UPDATE contrat SET statut='termine', date_signature=NOW()
    API->>MG: UPDATE annonce SET statut='archivee'
    API-->>FO: 200 { statut: 'termine' }
```
