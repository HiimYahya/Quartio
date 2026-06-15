# Tests — Quartio

Ce document recense les cas de tests automatisés du projet, la manière de les exécuter
et les résultats attendus.

Deux familles de tests :

1. **Tests d'intégration backend** (Jest + Supertest) — `api-rest-pa/tests/`
2. **Tests End-to-End** (Playwright) — `e2e/tests/`

---

## 1. Tests d'intégration backend (Jest + Supertest)

Ces tests démarrent l'application Express (`api-rest-pa/src/app.js`) et exécutent de
vraies requêtes HTTP contre une base de données **dédiée aux tests**, isolée de la
base de développement.

### 1.1 Prérequis

Créer la base de test PostgreSQL (une seule fois) :

```bash
docker exec quartio_db psql -U postgres -c "CREATE DATABASE pa_db_test;"
docker exec quartio_db psql -U postgres -d pa_db_test -f /docker-entrypoint-initdb.d/01_schema.sql
docker exec quartio_db psql -U postgres -d pa_db_test -f /docker-entrypoint-initdb.d/02_seed.sql
docker exec quartio_db psql -U postgres -d pa_db_test -f /docker-entrypoint-initdb.d/03_migrations.sql
```

`tests/env.setup.js` bascule automatiquement la configuration sur `DB_NAME_TEST`
(`pa_db_test`) et `MONGO_URI_TEST` pour ne pas polluer les données de dev.

### 1.2 Lancer les tests

En local (hors conteneur), avec les dépendances de dev installées :

```bash
cd api-rest-pa
npm install
npm test
```

> ⚠️ Le conteneur `quartio_api` est construit en mode `--production` (sans
> `devDependencies` telles que `jest`/`supertest`). Pour lancer la suite directement
> dans le conteneur, il faut d'abord copier les sources de test et installer les
> dépendances de dev :
>
> ```bash
> docker cp api-rest-pa/tests quartio_api:/app/tests
> docker exec quartio_api npm install --include=dev
> docker exec quartio_api npm test
> ```

### 1.3 Suites et cas testés (89 tests / 6 suites)

#### `tests/auth.test.js` — Authentification (19 tests)

- **POST /api/auth/register** (3)
  - crée un compte et demande la vérification de l'email
  - retourne 409 si l'email est déjà utilisé
  - retourne 400 si le mot de passe est trop court
- **POST /api/auth/verify-email + /api/auth/resend-verification** (4)
  - retourne 400 avec un code invalide
  - vérifie l'email avec le bon code et crédite les points de bienvenue
  - retourne 400 si l'email est déjà vérifié
  - resend-verification répond toujours avec un message générique
- **POST /api/auth/login** (3)
  - bloque la connexion avant vérification de l'email
  - retourne un token après vérification de l'email
  - retourne 401 avec un mauvais mot de passe
- **GET /api/auth/me** (2)
  - retourne le profil de l'utilisateur connecté
  - retourne 401 sans token
- **POST /api/auth/refresh + /api/auth/logout** (3)
  - retourne un nouveau access_token
  - retourne 401 avec un token invalide
  - logout révoque le refresh token
- **POST /api/auth/forgot-password + /api/auth/reset-password** (3)
  - forgot-password répond toujours avec un message générique
  - réinitialise le mot de passe avec un token valide
  - retourne 400 avec un token invalide
- **MFA — activation puis login** (1)
  - active le MFA et exige un code TOTP au login

#### `tests/quartiers.test.js` — Quartiers (11 tests)

- **GET /api/quartiers** (2)
  - retourne une liste paginée de quartiers
  - respecte les paramètres de pagination
- **POST /api/quartiers (admin)** (2)
  - crée un quartier (admin)
  - retourne 401 sans token
- **Détection de chevauchement de zones (Turf.js)** (5)
  - crée un quartier avec une géométrie
  - refuse une zone qui chevauche un quartier existant
  - accepte une zone qui ne chevauche aucun quartier
  - refuse la modification d'un quartier si la nouvelle géométrie chevauche un autre
  - autorise la modification d'un quartier en gardant sa propre géométrie (pas d'auto-conflit)
- **GET /api/quartiers/:id** (2)
  - retourne un quartier par id
  - retourne 404 pour un id inexistant

#### `tests/ray-casting.test.js` — Détection de quartier par adresse (6 tests)

- retourne 400 si adresse manquante
- retourne 403 si un autre utilisateur non-admin tente la détection
- retourne 422 si l'adresse est introuvable (Nominatim vide)
- retourne 404 si le point géocodé ne tombe dans aucun quartier
- détecte le quartier correspondant via ray casting et crée la relation HABITE
- un admin peut détecter le quartier pour un autre utilisateur

#### `tests/annonces.test.js` — CRUD annonces (9 tests)

- retourne 401 sans token à la création
- retourne 400 si id_quartier manquant
- crée une annonce
- liste les annonces (paginé)
- retourne une annonce par id
- retourne 404 pour un id inexistant
- refuse la modification par un autre utilisateur
- modifie l'annonce (auteur)
- supprime l'annonce (auteur)

#### `tests/contrats.test.js` — Flux contrat (12 tests)

- **Flux contrat : annonce → contrat → signature → finalisation** (11)
  - crée un contrat depuis l'annonce (acheteur)
  - refuse un second contrat pour la même annonce/acheteur
  - le vendeur ne peut pas accepter sa propre annonce
  - apparaît dans "mes contrats" pour les deux parties
  - refuse la signature d'un tiers non participant
  - l'acheteur signe : statut passe à "signe"
  - l'acheteur ne peut pas signer deux fois
  - le vendeur signe : finalisation + transfert de points
  - l'annonce liée est archivée après finalisation
  - le document archivé contient les deux signatures
  - un contrat déjà finalisé ne peut plus être signé
- **Contrat avec service gratuit (points_echanges = 0)** (1)
  - finalisation sans transfert de points

#### `tests/quartio-ql.test.js` — Langage maison Quartio-QL (32 tests)

Tests purement unitaires (lexer + parser + transpileur), sans accès à une base de
données — exécutables sans la stack docker.

- **Lexer** (6)
  - tokenise les mots-clés indépendamment de la casse
  - distingue les opérateurs multi-caractères des opérateurs simples (`>=` avant `>`, `!=` avant `=`)
  - ne tokenise pas un mot-clé comme préfixe d'un identifiant (word boundary)
  - reconnaît `ORDER BY` comme un seul token malgré l'espace
  - rejette un caractère inconnu
  - ignore les espaces, tabulations et retours à la ligne (`group: SKIPPED`)
- **FIND** (9)
  - FIND simple sans clause
  - WHERE avec égalité (chaîne)
  - WHERE avec opérateurs de comparaison numériques (`>`, `<`, `>=`, `<=`, `!=`)
  - WHERE avec CONTAINS → `$regex` insensible à la casse
  - WHERE avec IN → `$in`
  - WHERE avec NOT IN → `$nin`
  - WHERE avec plusieurs conditions liées par AND
  - WHERE avec plusieurs conditions liées par OR
  - WHERE mélange AND/OR : AND prioritaire, regroupé sous `$or`
  - valeur NULL et booléenne
  - ORDER BY avec direction ASC/DESC et défaut ASC
  - LIMIT personnalisé et plafond de sécurité à 200
  - combine WHERE, ORDER BY et LIMIT
- **COUNT** (2)
  - COUNT sans clause
  - COUNT avec WHERE
- **INSERT** (3)
  - INSERT avec un document JSON simple
  - INSERT avec un document JSON imbriqué
  - INSERT accepte des clés entre guillemets
- **UPDATE** (2)
  - UPDATE avec WHERE et SET
  - UPDATE sans WHERE est une erreur de syntaxe (clause obligatoire)
- **DELETE** (2)
  - DELETE avec WHERE
  - DELETE sans WHERE est une erreur de syntaxe (clause obligatoire)
- **Erreurs** (4)
  - rejette une requête vide
  - rejette un mot-clé de requête inconnu
  - rejette une chaîne non terminée (erreur de tokenisation)
  - rejette un opérateur de comparaison invalide

### 1.4 Résultat attendu

**89/89 tests passants** (6 suites). Dernière vérification : 2026-06-13.

> `tests/quartio-ql.test.js` ne dépend ni de PostgreSQL ni de Neo4j et peut être lancé
> isolément en local : `npx jest quartio-ql`. Les 5 autres suites nécessitent la stack
> docker complète (PostgreSQL + MongoDB + Neo4j).

---

## 2. Tests End-to-End (Playwright)

Les tests E2E pilotent un vrai navigateur contre la pile complète lancée via
`docker-compose` (Frontoffice sur `:5173`, Backoffice sur `:5174`, API sur `:3000`,
PostgreSQL, MongoDB, Neo4j).

### 2.1 Prérequis

```bash
docker compose up -d
cd e2e
npm install
npx playwright install   # une seule fois, installe les navigateurs
```

> ⚠️ La route `/api/auth/login` et `/api/auth/register` sont protégées par un
> rate-limiter (20 requêtes / 15 min, en mémoire). Si les tests échouent avec une
> erreur "Trop de tentatives" après plusieurs exécutions rapprochées, réinitialiser
> avec :
>
> ```bash
> docker compose restart api
> ```

### 2.2 Lancer les tests

```bash
cd e2e
npx playwright test            # tous les tests
npm run test:front             # uniquement Frontoffice
npm run test:back              # uniquement Backoffice
npm run report                 # ouvre le rapport HTML généré
```

### 2.3 Cas testés (5 tests)

#### `tests/frontoffice.spec.js` — Frontoffice (2 tests)

- **inscription, vérification email, connexion et publication d'une annonce**
  Crée un compte, vérifie l'email via le code (BDD), se connecte, et publie une
  nouvelle annonce dans un quartier.
- **accepter un service payant et signer un contrat (double signature)**
  Un second utilisateur accepte une annonce de service, un contrat est créé, puis
  l'acheteur et le vendeur signent chacun électroniquement le contrat (canvas de
  signature).

#### `tests/backoffice.spec.js` — Backoffice (3 tests)

- **connexion admin**
  Connexion d'un compte administrateur et redirection vers le dashboard.
- **créer un quartier en dessinant une zone sur la carte**
  Création d'un nouveau quartier en dessinant un polygone sur la carte Leaflet
  (clics successifs + double-clic pour fermer la zone), avec vérification de
  l'absence de chevauchement avec les zones existantes.
- **gérer les incidents : création et changement de statut**
  Création d'un incident via le formulaire modal, puis changement de son statut
  ("en_cours") directement depuis la liste.

### 2.4 Résultat attendu

**5/5 tests passants** (2 projets : `frontoffice`, `backoffice`). Un rapport HTML est
généré automatiquement dans `e2e/playwright-report/` (consultable via
`npm run report`). Dernière vérification : 2026-06-13.
