# Documentation technique — Quartio

## Sommaire

1. [Architecture générale](#1-architecture-générale)
2. [Infrastructure Docker](#2-infrastructure-docker)
3. [Backend — api-rest-pa](#3-backend--api-rest-pa)
4. [Frontoffice](#4-frontoffice)
5. [Backoffice — CRUD des sections](#5-backoffice--crud-des-sections)
6. [Backoffice — Gestion des quartiers sur carte](#6-backoffice--gestion-des-quartiers-sur-carte)
7. [Rattachement d'un utilisateur à un quartier par adresse](#7-rattachement-dun-utilisateur-à-un-quartier-par-adresse)
8. [Flux de contrat pour services payants](#8-flux-de-contrat-pour-services-payants)
9. [Authentification avancée — Email, MFA, Reset](#9-authentification-avancée--email-mfa-reset)
10. [Temps réel — Socket.io](#10-temps-réel--socketio)
11. [RGPD — Export et suppression de compte](#11-rgpd--export-et-suppression-de-compte)
12. [Événements — Inscription, Swipe Neo4j, Suggestions](#12-événements--inscription-swipe-neo4j-suggestions)
13. [Statistiques backoffice](#13-statistiques-backoffice)
14. [SSO token Java Desktop](#14-sso-token-java-desktop)
15. [Alertes temps réel (Socket.io)](#15-alertes-temps-réel-socketio)
16. [Votes paramétrables](#16-votes-paramétrables)
17. [Rôle modérateur (backoffice)](#17-rôle-modérateur-backoffice)
18. [Langage d'interrogation Quartio-QL](#18-langage-dinterrogation-quartio-ql)
19. [Documentation Swagger](#19-documentation-swagger)

---

## 1. Architecture générale

```
Quartio/
├── api-rest-pa/          ← API REST Node.js (Express)
├── Frontoffice/          ← App React utilisateurs  (port 5173)
├── Backoffice/           ← App React admin         (port 5174)
└── docker-compose.yml    ← Orchestration complète
```

### Bases de données

| Base | Usage | Port |
|---|---|---|
| **PostgreSQL 16** | Utilisateurs, quartiers, contrats, transactions | 5432 |
| **MongoDB 7** | Annonces, événements, incidents, messages | 27017 |
| **Neo4j 5** | Relations sociales (habite, suit, amis) | 7474 / 7687 |

### Flux de données

```
Navigateur
  ├── http://localhost:5173  →  Frontoffice (nginx)  →  API :3000
  └── http://localhost:5174  →  Backoffice  (nginx)  →  API :3000
                                                           ├── PostgreSQL
                                                           ├── MongoDB
                                                           └── Neo4j
```

---

## 2. Infrastructure Docker

### Ce qui a été fait

Le `docker-compose.yml` orchestre 6 services : `api`, `frontoffice`, `backoffice`, `db` (PostgreSQL), `mongo`, `neo4j`.

**Ajout du service Backoffice** — le Backoffice n'était pas dockerisé initialement. Ajout de :
- `Backoffice/Dockerfile` — build multi-stage : Node 20 pour compiler Vite, nginx:alpine pour servir le dist
- `Backoffice/nginx.conf` — SPA routing (`try_files $uri /index.html`), gzip, cache des assets
- Service `backoffice` dans le compose, port 5174

**Correction SSL PostgreSQL** — le `.env` contenait `DATABASE_URL` avec `ssl: { rejectUnauthorized: false }` qui forçait SSL sur le PostgreSQL local (non configuré pour SSL). Suppression de `DATABASE_URL` ; le backend utilise maintenant les variables `DB_HOST`, `DB_PORT`, etc. sans SSL.

**Correction CORS multi-origines** — le backend n'acceptait que `http://localhost:5173`. Le Backoffice (port 5174) était bloqué. La variable `CORS_ORIGIN` accepte maintenant une liste séparée par virgules :

```js
// api-rest-pa/src/app.js
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : '*'
app.use(cors({ origin: corsOrigins, ... }))
```

```
# Backend/.env
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

**URL API** — les deux frontends sont buildés avec `VITE_API_URL=http://localhost:3000/api` injecté via `build.args` dans le compose. Cette URL est compilée dans le bundle Vite au moment du `docker compose up --build`.

---

## 3. Backend — api-rest-pa

### Correction de la connexion PostgreSQL

```js
// api-rest-pa/src/config/db.js
const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Pas de SSL — connexion interne Docker
})
```

### Route DELETE /api/contrats/:id

Route manquante ajoutée pour permettre à l'admin de supprimer un contrat.

```js
// api-rest-pa/src/routes/contrats.routes.js
router.delete('/:id', auth, role('admin'), ctrl.remove)

// api-rest-pa/src/controllers/contrats.controller.js
exports.remove = async (req, res, next) => {
  const result = await pool.query(
    'DELETE FROM contrat WHERE id_contrat=$1 RETURNING id_contrat',
    [req.params.id]
  )
  if (result.rows.length === 0)
    return res.status(404).json({ error: 'Contrat non trouvé' })
  res.json({ message: 'Contrat supprimé' })
}
```

### Détection de chevauchement de quartiers (Turf.js)

Installé : `@turf/boolean-intersects`

Avant tout INSERT ou UPDATE de quartier, l'API vérifie que le nouveau polygone GeoJSON ne chevauche aucun quartier existant :

```js
// api-rest-pa/src/controllers/quartiers.controller.js
const booleanIntersects = require('@turf/boolean-intersects').default

async function checkOverlap(newGeoStr, excludeId = null) {
  if (!newGeoStr) return null
  const newGeo = JSON.parse(newGeoStr)
  const existing = await pool.query(
    'SELECT id_quartier, nom, geometrie FROM quartier WHERE geometrie IS NOT NULL AND id_quartier != $1',
    [excludeId ?? -1]
  )
  for (const row of existing.rows) {
    if (booleanIntersects(newGeo, JSON.parse(row.geometrie))) {
      return row.nom  // retourne le nom du premier quartier en conflit
    }
  }
  return null
}

// Dans create et update :
const conflict = await checkOverlap(geometrie, parseInt(id) /* null pour create */)
if (conflict)
  return res.status(409).json({ error: `Zone chevauche le quartier "${conflict}"` })
```

`excludeId` permet d'exclure le quartier en cours de modification de la vérification (un quartier ne se chevauche pas lui-même).

---

## 4. Frontoffice

### Correction écran blanc au démarrage

**Cause** : `react-tinder-card` (utilisé dans la vue swipe des événements) déclare `@react-spring/web` comme peer dependency obligatoire. Ce package n'était pas installé. Vite compilait quand même mais générait un stub qui levait une exception au chargement :

```
throw Error(`Could not resolve "@react-spring/web" imported by "react-tinder-card"`)
```

Cette exception non catchée crashait React avant le premier render → écran blanc.

**Correction** :
```bash
npm install @react-spring/web@^9.5.5 --legacy-peer-deps
```

### Fichier .env Frontoffice

Créé `Frontoffice/.env` (ignoré par git via `.gitignore`) :
```
VITE_API_URL=http://localhost:3000/api
```

---

## 5. Backoffice — CRUD des sections

### État initial

Avant les modifications, seules certaines opérations existaient :

| Page | Avant |
|---|---|
| Utilisateurs | Lecture + Changement de rôle + Suppression |
| Annonces | Lecture + Changement de statut |
| Événements | Lecture + Changement de statut + Suppression |
| Votes | Lecture + Changement de statut + Suppression |
| Incidents | Lecture + Changement de statut + Suppression |
| Contrats | Lecture + Changement de statut |
| Quartiers | Lecture + Création + Modification + Suppression |

### Ce qui a été ajouté

| Page | Ajouté |
|---|---|
| **Utilisateurs** | Création via modal (appel `/auth/register` puis `PUT /utilisateurs/:id` pour le rôle) |
| **Annonces** | Création via modal + Suppression avec confirmation |
| **Événements** | Création via modal (titre, dates, lieu, capacité, quartier) |
| **Votes** | Création via modal avec options dynamiques (ajout/suppression d'options) |
| **Incidents** | Création via modal (titre, description, type, priorité) |
| **Contrats** | Suppression avec confirmation (+ route API DELETE ajoutée) |

### Pattern commun

Toutes les pages suivent le même patron :
- Bouton `+ Nouveau…` en haut à droite
- Modal avec formulaire contrôlé React
- En cas d'erreur API : message d'erreur affiché dans la modal
- Toutes les suppressions passent par une **modale de confirmation** (plus de `window.confirm()`)
- Optimistic UI : la liste est mise à jour localement sans recharger depuis l'API

---

## 6. Backoffice — Gestion des quartiers sur carte

C'est la partie la plus technique. Voici une explication complète.

### Vue d'ensemble

La page Quartiers est composée de :
- Une **colonne gauche** (280px) : liste des quartiers + formulaire de création/modification
- Une **carte Leaflet** (flex-1) : visualisation des polygones existants + outil de dessin

Une seule carte sert à la fois à **afficher** les quartiers existants et à **dessiner** de nouveaux polygones. L'utilisateur voit le contexte (quartiers existants) pendant qu'il dessine.

---

### Problème 1 — Modal derrière la carte

**Cause** : Leaflet crée son propre contexte de stacking CSS avec des `z-index` allant jusqu'à 700. Même avec `z-index: 9999` en Tailwind, une modal rendue *à l'intérieur* du DOM de la page restait derrière les couches Leaflet si un ancêtre avait un `position` ou `transform` qui créait un nouveau contexte d'empilement.

**Solution** : `ReactDOM.createPortal` rend la modal directement dans `document.body`, complètement hors de la hiérarchie DOM de la carte.

```jsx
import { createPortal } from 'react-dom'

function Modal({ children }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}>
      {children}
    </div>,
    document.body   // ← rendu hors de tout contexte Leaflet
  )
}

// Utilisation :
{confirm && (
  <Modal>
    <div className="bg-white rounded-2xl p-6 ...">...</div>
  </Modal>
)}
```

---

### Problème 2 — Double-clic et points parasites

**Cause** : dans un navigateur, un double-clic génère les événements dans cet ordre :

```
click → click → dblclick
```

Les deux `click` sont traités par le handler de la carte *avant* que `dblclick` ne se déclenche. Ils ajoutent (ou déplacent) des points, modifiant la forme du polygone avant qu'il ne soit fermé.

#### Première tentative : `slice(0, -2)`

```js
dblclick(e) {
  const cleaned = pointsRef.current.slice(0, -2)  // retire les 2 derniers points
  onComplete(createGeoJson(cleaned))
}
```

**Pourquoi ça ne marchait pas** : `slice(0, -2)` suppose que les 2 clicks ont tous les deux *ajouté* un point. Mais si un point était **sélectionné** (en cours de déplacement), le premier click le *déplaçait* (taille du tableau inchangée) et le second *ajoutait*. `slice(0, -2)` retirait alors 2 éléments là où 1 seul avait été ajouté → la forme finale perdait un point valide.

#### Solution finale : pile d'historique

Chaque opération (ajout ou déplacement) sauvegarde l'état complet avant de s'exécuter. Le double-clic annule exactement autant d'opérations que de clicks parasites reçus, quel que soit leur type.

```js
const pointsRef  = useRef([])
const historyRef = useRef([])   // pile : chaque entrée = snapshot avant l'opération

// Enregistre l'état courant, puis applique le nouvel état
const commit = (newPts) => {
  historyRef.current = [...historyRef.current, [...pointsRef.current]]
  pointsRef.current  = newPts
  setPts([...newPts])
}

// Restaure l'état précédent depuis la pile
const undo = () => {
  if (historyRef.current.length === 0) return
  const prev = historyRef.current[historyRef.current.length - 1]
  historyRef.current = historyRef.current.slice(0, -1)
  pointsRef.current  = prev
  setPts([...prev])
}

useMapEvents({
  click(e) {
    if (selectedIdxRef.current !== null) {
      // Déplace le point sélectionné (commit sauvegarde l'état avant)
      const next = [...pointsRef.current]
      next[selectedIdxRef.current] = [e.latlng.lat, e.latlng.lng]
      commit(next)
      setSelection(null)
    } else {
      commit([...pointsRef.current, [e.latlng.lat, e.latlng.lng]])
    }
  },
  dblclick(e) {
    e.originalEvent.preventDefault()
    undo()  // annule le click parasite précédant le dblclick
    const finalPts = pointsRef.current
    reset()
    if (finalPts.length < 3) return
    onComplete(createGeoJson(finalPts))
  },
})
```

**Trace d'exécution — cas simple :**
```
Clics : A → B → C → dblclick à X

click A  : commit([A])      ; history = [[]]
click B  : commit([A,B])    ; history = [[], [A]]
click C  : commit([A,B,C])  ; history = [[], [A], [A,B]]
dblclick :
  click X : commit([A,B,C,X]) ; history = [..., [A,B,C]]
  undo()  : restaure [A,B,C]  ; history = [[], [A], [A,B]]
  → ferme le polygone avec [A, B, C] ✓
```

**Trace d'exécution — avec déplacement de B :**
```
Points : [A, B, C], B sélectionné

dblclick à X :
  click 1 : déplace B→X, commit([A,X,C]) ; history = [..., [A,B,C]], selectedIdx=null
  undo()  : restaure [A,B,C]             ; history = [...]
  → ferme le polygone avec [A, B, C] ✓ (le déplacement temporaire est annulé)
```

---

### Problème 3 — doubleClickZoom de Leaflet

**Cause** : par défaut, Leaflet zoome sur la carte au double-clic. L'utilisateur voyait la carte zoomer au moment de fermer son polygone, ce qui était désorientant.

**Solution** : désactiver `doubleClickZoom` sur le `MapContainer`.

```jsx
<MapContainer
  center={[48.8566, 2.3522]}
  zoom={13}
  doubleClickZoom={false}   // ← empêche le zoom automatique
  style={{ height: '100%', width: '100%' }}
>
```

---

### Problème 4 — Retour visuel pendant le dessin

**Cause** : le composant `<Polygon>` de react-leaflet ne s'affiche qu'à partir de 3 points. Pour les 1er et 2e clics, l'utilisateur ne voyait rien → il ne savait pas si ses clics étaient enregistrés.

**Solution** : afficher un `CircleMarker` sur chaque point et une `Polyline` qui relie les points en temps réel.

```jsx
return (
  <>
    {/* Ligne reliant les points */}
    <Polyline positions={pts}
      pathOptions={{ color: '#4f46e5', weight: 2, dashArray: '6' }} />

    {/* Aperçu du polygone dès 3 points */}
    {pts.length >= 3 && (
      <Polygon positions={pts}
        pathOptions={{ color: '#4f46e5', fillOpacity: 0.15, dashArray: '6' }} />
    )}

    {/* Marqueur sur chaque point */}
    {pts.map((p, i) => (
      <CircleMarker key={i} center={p} radius={isSelected ? 9 : 5}
        pathOptions={{
          color:     isSelected ? '#f59e0b' : '#4f46e5',
          fillColor: isSelected ? '#fbbf24' : '#fff',
          fillOpacity: 1, weight: 2,
        }}
        eventHandlers={{ click: ... }}
      />
    ))}
  </>
)
```

---

### Fonctionnalité — Déplacement d'un point

**Interaction** : clic sur un point → il devient orange (sélectionné) → clic sur la carte → le point se déplace à la nouvelle position.

**Problème technique** : un clic sur un `CircleMarker` remonte (*bubbling* Leaflet) jusqu'à la carte. Sans protection, le handler `click` de la carte se déclenchait aussi, ce qui :
1. sélectionnait le point (via le handler du CircleMarker)
2. **et simultanément** déplaçait/ajoutait un point (via le handler de la carte)

**Solution** : `L.DomEvent.stopPropagation(e)` dans le handler du CircleMarker bloque la propagation avant qu'elle n'atteigne la carte.

```jsx
eventHandlers={{
  click(e) {
    L.DomEvent.stopPropagation(e)   // ← bloque le bubbling vers la carte
    setSelection(selectedIdxRef.current === i ? null : i)
  },
}}
```

**Pourquoi `selectedIdxRef` et pas seulement `selectedIdx` (state) ?**

Les handlers Leaflet (`click`, `dblclick`) s'exécutent dans le contexte DOM natif, hors du cycle React. Le state React est asynchrone : quand un handler Leaflet s'exécute, il lit une *closure* capturée au dernier render, pas la valeur la plus récente. Un `ref`, lui, est toujours synchrone et contient la valeur actuelle.

```js
const selectedIdxRef = useRef(null)  // toujours à jour pour les handlers
const [selectedIdx, setSelectedIdx] = useState(null)  // pour le rendu JSX

const setSelection = (idx) => {
  selectedIdxRef.current = idx   // mise à jour synchrone
  setSelectedIdx(idx)            // déclenche le re-render
}
```

---

### Fonctionnalité — Raccourcis clavier

Un `useEffect` ajoute un listener `keydown` sur `window` uniquement quand le mode dessin est actif. Il est retiré automatiquement à la désactivation.

```js
useEffect(() => {
  if (!isDrawing) return
  const onKey = (e) => {
    if (e.key === 'Escape') {
      setSelection(null)                          // désélectionne
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()                          // évite la navigation arrière
      if (selectedIdxRef.current !== null) {
        commit(pts.filter((_, i) => i !== selectedIdxRef.current))  // supprime le point sélectionné
        setSelection(null)
      } else {
        undo()                                    // annule la dernière opération
      }
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [isDrawing])
```

| Touche | Effet |
|---|---|
| Clic sur un point | Sélectionne le point (orange) |
| Clic sur la carte (point sélectionné) | Déplace le point sélectionné |
| `Backspace` / `Delete` | Annule la dernière opération (ou supprime le point sélectionné) |
| `Échap` | Désélectionne le point courant |
| Double-clic | Ferme le polygone |

---

### Fonctionnalité — Détection de chevauchement

La détection est implémentée à **deux niveaux** : frontend (retour immédiat) et backend (protection API).

#### Frontend (Turf.js — `@turf/boolean-intersects`)

Dès que l'utilisateur ferme son polygone (double-clic), avant même de soumettre le formulaire :

```js
const detectOverlap = (geoStr, quartiers, excludeId = null) => {
  const newPoly = JSON.parse(geoStr)
  return quartiers.filter((q) => {
    if (!q.geometrie) return false
    if (excludeId && q.id_quartier === excludeId) return false
    return booleanIntersects(newPoly, JSON.parse(q.geometrie))
  })
}

const handleDrawComplete = (geo) => {
  setDrawMode(false)
  const conflicts = detectOverlap(geo, quartiers, editTarget?.id_quartier)
  if (conflicts.length > 0) {
    setOverlapIds(conflicts.map((q) => q.id_quartier))  // passe en rouge sur la carte
    setOverlapError(`Chevauchement avec : ${conflicts.map((q) => q.nom).join(', ')}`)
    return  // ne stocke pas le polygone invalide
  }
  setForm((f) => ({ ...f, geometrie: geo }))
}
```

Les quartiers en conflit passent **en rouge** dans la liste et sur la carte pour que l'utilisateur visualise exactement où est le problème.

#### Backend (protection API — même logique)

```js
// POST /api/quartiers et PUT /api/quartiers/:id
const conflict = await checkOverlap(geometrie, parseInt(id))
if (conflict)
  return res.status(409).json({ error: `Zone chevauche le quartier "${conflict}"` })
```

Même si quelqu'un appelle l'API directement (sans passer par le Backoffice), la règle d'intégrité est garantie côté serveur.

---

### Format GeoJSON

La géométrie des quartiers est stockée en **TEXT** dans PostgreSQL (pas PostGIS — non disponible). Le format utilisé est GeoJSON Feature :

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [2.34, 48.85],
        [2.36, 48.85],
        [2.36, 48.87],
        [2.34, 48.87],
        [2.34, 48.85]   ← premier point répété pour fermer l'anneau
      ]
    ]
  }
}
```

**Attention à l'ordre des coordonnées** : GeoJSON utilise `[longitude, latitude]` (x, y) mais Leaflet utilise `[latitude, longitude]`. La conversion se fait à deux endroits :

```js
// Leaflet → GeoJSON (à la fermeture du polygone)
const ring = [
  ...pts.map(([lat, lng]) => [lng, lat]),   // [lat,lng] → [lng,lat]
  [pts[0][1], pts[0][0]],                    // fermeture de l'anneau
]

// GeoJSON → Leaflet (pour l'affichage des quartiers existants)
const coords = geo.geometry.coordinates[0]
return coords.map(([lng, lat]) => [lat, lng])  // [lng,lat] → [lat,lng]
```

---

## 7. Rattachement d'un utilisateur à un quartier par adresse

### Objectif

Depuis la page Profil du Frontoffice, l'utilisateur saisit son adresse. Le système détermine automatiquement à quel quartier il appartient et crée la relation dans Neo4j.

### Flux complet

```
Utilisateur saisit adresse
        ↓
POST /api/utilisateurs/:id/quartier/detect
        ↓
[1] Géocodage Nominatim (OpenStreetMap)
    adresse → { lat, lng }
        ↓
[2] Ray casting sur tous les quartiers avec géométrie
    → quartier trouvé ou null
        ↓
    ┌──────────────────┬──────────────────────┐
    │ Trouvé           │ Non trouvé           │
    │ 200 + quartier   │ 404 + message        │
    │ HABITE créé Neo4j│ coordonnées retournées│
    └──────────────────┴──────────────────────┘
```

### Géocodage — Nominatim

Nominatim est l'API de géocodage d'OpenStreetMap. Elle est **gratuite et sans clé API**. L'API convertit une adresse textuelle en coordonnées `lat/lng`.

```js
const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(adresse)}&format=json&limit=1`
const geoData = await fetch(geoUrl, {
  headers: { 'User-Agent': 'Quartio/1.0 contact@quartio.fr' }  // obligatoire Nominatim
}).then(r => r.json())

const lat = parseFloat(geoData[0].lat)
const lng = parseFloat(geoData[0].lon)
```

### Algorithme de ray casting (point dans polygone)

Le ray casting est un algorithme classique de géométrie computationnelle. Il détermine si un point est à l'intérieur d'un polygone en lançant un rayon horizontal depuis ce point et en comptant combien de fois il coupe les arêtes du polygone.

**Règle :**
- Nombre de croisements **impair** → point **DEDANS**
- Nombre de croisements **pair** → point **DEHORS**

```
     Point P ────────────────────► (rayon vers la droite)
                ╲       ╱
           2 croisements (pair) → DEHORS

     Point P ──────────╲────────► 
              ╱          ╲
           1 croisement (impair) → DEDANS
```

```js
// ring : tableau de [lng, lat] (format GeoJSON)
function pointInPolygon(lat, lng, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]; const yi = ring[i][1]  // [lng, lat]
    const xj = ring[j][0]; const yj = ring[j][1]

    // Le rayon coupe l'arête si :
    // 1. Le point P est entre les latitudes des deux sommets
    // 2. P est à gauche du point d'intersection
    const cross = ((yi > lat) !== (yj > lat))
      && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)

    if (cross) inside = !inside
  }
  return inside
}
```

### Routes API

| Méthode | Route | Description |
|---|---|---|
| `GET`  | `/api/utilisateurs/:id/quartiers` | Quartier(s) actuel(s) de l'utilisateur (Neo4j) |
| `POST` | `/api/utilisateurs/:id/quartier/detect` | Géocode + ray cast + assigne |
| `POST` | `/api/utilisateurs/:id/quartier` | Assigne manuellement (par id_quartier) |
| `DELETE` | `/api/utilisateurs/:id/quartier/:idQ` | Retire l'utilisateur du quartier |

### Frontoffice — ProfilPage

Section "Mon quartier" ajoutée dans la page profil :
- Affiche le quartier actuel (chargé depuis `GET /utilisateurs/:id/quartiers`)
- Champ d'adresse + bouton "Trouver mon quartier"
- Message de succès si quartier trouvé (affiche le nom)
- Message d'erreur explicite si hors zone ou adresse introuvable

---

## 8. Flux de contrat pour services payants

### Vue d'ensemble

Le flux complet d'un échange de service payant :

```
[1] Vendeur publie une annonce payante (X points)
[2] Acheteur voit l'annonce → clic "Accepter ce service"
[3] Contrat créé automatiquement (statut: en_attente)
[4] Chaque partie signe le contrat (signature canvas + PDF optionnel)
[5] Quand les 2 ont signé → finalisation automatique :
    - X points débités de l'acheteur
    - X points crédités au vendeur
    - 2 transactions créées dans l'historique
    - Contrat → statut "termine"
    - Annonce → statut "archivee"
    - Notifications envoyées aux deux parties
```

### Migration SQL (table contrat)

5 colonnes ajoutées à la table `contrat` existante :

```sql
ALTER TABLE contrat ADD COLUMN IF NOT EXISTS id_vendeur       INTEGER REFERENCES utilisateur(id_utilisateur);
ALTER TABLE contrat ADD COLUMN IF NOT EXISTS id_acheteur      INTEGER REFERENCES utilisateur(id_utilisateur);
ALTER TABLE contrat ADD COLUMN IF NOT EXISTS id_annonce_mongo VARCHAR(50);
ALTER TABLE contrat ADD COLUMN IF NOT EXISTS signe_vendeur    BOOLEAN DEFAULT FALSE;
ALTER TABLE contrat ADD COLUMN IF NOT EXISTS signe_acheteur   BOOLEAN DEFAULT FALSE;
```

`signe_vendeur` et `signe_acheteur` permettent de suivre chaque signature indépendamment. La finalisation se déclenche quand les **deux** passent à `true`.

### Création du contrat (POST /api/annonces/:id/contrat)

```
Vérifications :
  - annonce.statut === 'active'
  - acheteur ≠ vendeur (pas d'auto-acceptation)
  - acheteur.points_solde >= annonce.cout_points
  - pas de contrat existant entre cet acheteur et cette annonce

→ INSERT contrat (id_vendeur, id_acheteur, id_annonce_mongo, points_echanges)
→ Neo4j : acheteur-[:SIGNE]→contrat, vendeur-[:SIGNE]→contrat, annonce-[:GENERE]→contrat
→ Notification au vendeur
→ Retourne le contrat créé (statut: en_attente)
```

Les points ne sont **pas encore débités** à ce stade. Le débit intervient uniquement à la finalisation.

### Signature (PUT /api/contrats/:id/signer)

```
Identification du rôle :
  req.user.id === contrat.id_vendeur  → isVendeur
  req.user.id === contrat.id_acheteur → isAcheteur

Vérifications :
  - contrat.statut ≠ 'termine' et ≠ 'annule'
  - le participant n'a pas déjà signé (signe_vendeur / signe_acheteur)
  - si acheteur et cout_points > 0 → vérifier points_solde suffisant

→ UPDATE contrat SET signe_[role] = TRUE, statut = 'signe'
→ Recharge le contrat pour vérifier les 2 flags
```

**Si les deux flags sont true → Finalisation :**

```
1. Débit acheteur  : points_solde -= points_echanges
2. Crédit vendeur  : points_solde += points_echanges
3. Création de 2 transactions dans transaction_points
4. Relations Neo4j : contrat-[:LIE_A]→transaction (×2)
5. UPDATE contrat SET statut = 'termine', date_signature = NOW()
6. Annonce MongoDB : statut → 'archivee'
7. Notifications aux deux parties
```

### Routes API

| Méthode | Route | Auth | Description |
|---|---|---|---|
| `GET`    | `/api/contrats` | ✓ | Mes contrats (vendeur ou acheteur) avec noms des participants |
| `GET`    | `/api/contrats/:id` | ✓ participant | Détail + état des signatures |
| `POST`   | `/api/contrats` | ✓ | Création manuelle (backoffice) |
| `POST`   | `/api/annonces/:id/contrat` | ✓ | Accepter une annonce → crée le contrat |
| `PUT`    | `/api/contrats/:id/signer` | ✓ participant | Signer + finalisation auto si 2/2 |
| `PUT`    | `/api/contrats/:id/statut` | admin | Forcer un statut (backoffice) |
| `DELETE` | `/api/contrats/:id` | admin | Supprimer |

### Frontoffice — AnnonceDetailPage

Bouton "Accepter ce service (X pts)" ajouté :
- Visible uniquement si l'utilisateur n'est **pas** l'auteur de l'annonce
- Désactivé si `annonce.statut !== 'active'`
- En cas de contrat déjà existant → redirige directement vers ce contrat (409 avec `id_contrat`)
- Note informative : "Les points ne sont débités qu'à la finalisation"

### Frontoffice — ContratDetailPage

Bloc "Participants" ajouté :
- Affiche vendeur et acheteur avec leurs noms
- Badge "✓ Signé" (vert) ou "En attente" (gris) pour chacun
- Compteur "X / 2 signatures"
- Message "En attente de la signature de l'autre partie" après avoir signé
- Message de finalisation avec montant transféré quand `statut === 'termine'`
- Rechargement automatique depuis l'API après signature pour refléter l'état exact

---

---

## 9. Authentification avancée — Email, MFA, Reset

### Migrations SQL

Trois évolutions de schéma appliquées sur la table `utilisateur` et deux nouvelles tables :

```sql
-- Colonne de vérification email
ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS email_verifie BOOLEAN DEFAULT FALSE;

-- Colonne MFA
ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS mfa_actif BOOLEAN DEFAULT FALSE;

-- Table de vérification email (OTP 6 chiffres, TTL 15 min)
CREATE TABLE IF NOT EXISTS email_verification (
  id             SERIAL PRIMARY KEY,
  id_utilisateur INTEGER NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
  code           VARCHAR(6) NOT NULL,
  expire_le      TIMESTAMP NOT NULL,
  utilise        BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- Table de reset mot de passe (token 64 octets, TTL 1h)
CREATE TABLE IF NOT EXISTS password_reset (
  id             SERIAL PRIMARY KEY,
  id_utilisateur INTEGER NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
  token          VARCHAR(128) UNIQUE NOT NULL,
  expire_le      TIMESTAMP NOT NULL,
  utilise        BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMP DEFAULT NOW()
);
```

---

### 9.1 Vérification email à l'inscription

**Flux :**

```
POST /auth/register
  → hash mot de passe
  → INSERT utilisateur (email_verifie = FALSE)
  → génère OTP 6 chiffres (Math.random × 10^6, 0-padded)
  → INSERT email_verification (code, expire_le = NOW() + 15 min)
  → sendVerificationEmail() via Nodemailer/Mailtrap
  → 201 { utilisateur, email_verification_required: true }

Frontoffice : redirect vers /verify-email?email=...

POST /auth/verify-email { email, code }
  → SELECT email_verification WHERE utilise=FALSE AND expire_le > NOW()
  → si valide : UPDATE utilisateur SET email_verifie=TRUE
  → UPDATE email_verification SET utilise=TRUE (tous les codes de cet user)
  → sendWelcomeEmail()
  → redirect vers /login?verified=1

POST /auth/resend-verification { email }
  → invalide les anciens codes (utilise=TRUE)
  → génère + stocke + envoie un nouveau code
  → réponse générique (sécurité : ne révèle pas si l'email existe)
```

**Login bloqué si non vérifié :**

```js
if (user.email_verifie === false) {
  return res.status(403).json({
    error: 'Veuillez vérifier votre adresse email...',
    email_verification_required: true,
    email: user.email,
  });
}
```

Le Frontoffice intercepte ce 403 dans `authStore.login()` et retourne `{ emailNotVerified: true, email }`. La `LoginPage` affiche alors une bannière amber avec un lien direct vers `/verify-email?email=...`.

**Pages Frontoffice créées :**
- `/verify-email` — 6 inputs séparés avec navigation clavier et paste, compte à rebours 15 min, bouton "Renvoyer" avec cooldown 60s
- `/login?verified=1` — bannière verte de confirmation

---

### 9.2 Mot de passe oublié / reset

**Flux :**

```
POST /auth/forgot-password { email }
  → SELECT utilisateur WHERE email=$1
  → si trouvé : invalide anciens tokens, génère token=crypto.randomBytes(64).hex
  → INSERT password_reset (token, expire_le = NOW() + 1h)
  → sendResetPasswordEmail() avec URL = FRONTEND_URL/reset-password/:token
  → réponse générique dans tous les cas (sécurité)

GET FRONTEND/reset-password/:token
  → page ResetPasswordPage affiche le formulaire

POST /auth/reset-password { token, mot_de_passe }
  → SELECT password_reset WHERE token=$1 AND utilise=FALSE AND expire_le > NOW()
  → si valide : UPDATE utilisateur SET mot_de_passe=bcrypt(new_password)
  → UPDATE password_reset SET utilise=TRUE
  → UPDATE refresh_token SET est_revoque=TRUE (révoque toutes les sessions)
  → redirect vers /login?reset=1
```

**Pages Frontoffice créées :**
- `/forgot-password` — formulaire email + message générique (ne révèle pas si le compte existe)
- `/reset-password/:token` — double saisie + indicateur de force (barre 4 niveaux, règles colorées)

**Indicateur de force du mot de passe :**

```js
let score = 0
if (password.length >= 8)          score++  // rouge → orange
if (/[A-Z]/.test(password))        score++  // orange → jaune
if (/[0-9]/.test(password))        score++  // jaune → bleu
if (/[^A-Za-z0-9]/.test(password)) score++  // bleu → vert
```

---

### 9.3 Authentification à deux facteurs (MFA / TOTP)

Implémenté avec les packages `speakeasy` (génération TOTP RFC 6238) et `qrcode` (génération QR code base64).

**Flux d'activation :**

```
GET /auth/mfa/setup  (auth requise)
  → speakeasy.generateSecret({ name: "Quartio (email@...)", length: 20 })
  → UPDATE utilisateur SET mfa_secret = secret.base32
  → QRCode.toDataURL(secret.otpauth_url)
  → 200 { secret, otpauth_url, qr_code: "data:image/png;base64,..." }

Frontoffice : affiche le QR code + clé manuelle, l'utilisateur scanne avec Google Authenticator/Authy

POST /auth/mfa/activate { code }  (auth requise)
  → speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 })
  → si valide : UPDATE utilisateur SET mfa_actif = TRUE
```

**Flux de login avec MFA actif :**

```
POST /auth/login { email, mot_de_passe }
  → vérifications normales (email_verifie, bcrypt)
  → si mfa_actif === true :
      → jwt.sign({ id, email, role, type: 'mfa' }, JWT_SECRET, { expiresIn: '10m' })
      → 200 { mfa_required: true, mfa_token: "..." }
  → Frontend : redirect vers /mfa, stocke mfa_token dans zustand (non persisté en localStorage)

POST /auth/mfa/verify { mfa_token, code }  (public)
  → jwt.verify(mfa_token) → vérifie payload.type === 'mfa'
  → SELECT utilisateur, speakeasy.totp.verify(code)
  → si valide : émet le vrai access_token + refresh_token (flux normal)
```

**Note sur la sécurité du `mfa_token` :** c'est un JWT distinct du JWT d'accès normal. Il est signé avec le même secret mais contient `type: 'mfa'` et expire en 10 minutes. Il ne donne accès à aucune route protégée — seul `/auth/mfa/verify` l'accepte.

**Désactivation :**

```
POST /auth/mfa/disable { code }  (auth requise)
  → speakeasy.totp.verify(code)  ← confirmation requise
  → UPDATE utilisateur SET mfa_actif=FALSE, mfa_secret=NULL
```

**Actions sensibles :**

```
POST /auth/mfa/verify-action { code }  (auth requise)
  → vérifie un code TOTP pour l'utilisateur connecté
  → utilisé par la signature de contrat, changement d'email, etc.
  → 200 { verified: true }
```

**Pages Frontoffice créées :**
- `/mfa` (`MfaVerifyPage`) — 6 inputs séparés, navigation clavier, paste
- `MfaSection` dans ProfilPage — affichage état activé/désactivé, QR code + clé manuelle au setup, désactivation avec confirmation

**Routes API :**

| Méthode | Route | Auth | Description |
|---|---|---|---|
| `GET`  | `/api/auth/mfa/setup` | JWT | Génère secret TOTP + QR code |
| `POST` | `/api/auth/mfa/activate` | JWT | Active le MFA (1er code TOTP) |
| `POST` | `/api/auth/mfa/disable` | JWT | Désactive le MFA |
| `POST` | `/api/auth/mfa/verify` | Public | Login MFA → vrai JWT |
| `POST` | `/api/auth/mfa/verify-action` | JWT | Vérifie TOTP pour action sensible |

**Service email (`src/config/mailer.js`) :**

Templates HTML branded créés pour :
- `sendVerificationEmail(to, prenom, code)` — code OTP 6 chiffres, expire 15 min
- `sendResetPasswordEmail(to, prenom, resetUrl)` — lien de reset, expire 1h
- `sendWelcomeEmail(to, prenom)` — envoyé après vérification réussie
- `sendContratSignatureEmail(to, prenom, contratId, serviceNom)` — notification signature

Transport configuré pour Mailtrap en dev (SMTP sandbox), variable `SMTP_HOST/PORT/USER/PASS` pour production (SendGrid, SES, etc.).

---

## 10. Temps réel — Socket.io

### Architecture

```
Browser (socket.io-client)
    │  WebSocket / polling
    ▼
API (socket.io Server)  ←── initSocket(httpServer)
    │
    ├── Middleware JWT : vérifie socket.handshake.auth.token
    ├── Map<userId, Set<socketId>> : présence en mémoire
    └── Rooms : conv:<mongoId>
```

Le serveur HTTP est créé manuellement dans `server.js` (`http.createServer(app)`) pour permettre à Socket.io de partager le même port que Express :

```js
// src/server.js
const httpServer = http.createServer(app);
initSocket(httpServer);
httpServer.listen(PORT);
```

### Fichier `src/socket/index.js`

Exporte trois fonctions :

| Fonction | Usage |
|---|---|
| `initSocket(httpServer)` | Appelé au démarrage — attache Socket.io |
| `emitNewMessage(convId, msg)` | Appelé par `envoyerMessage` — diffuse dans la room |
| `emitNotification(userId, notif)` | Émet `notification:new` à tous les sockets d'un user |

### Événements

**Client → Serveur :**

| Événement | Payload | Effet |
|---|---|---|
| `join:conversation` | `{ conversationId }` | `socket.join('conv:'+id)` |
| `leave:conversation` | `{ conversationId }` | `socket.leave('conv:'+id)` |
| `typing:start` | `{ conversationId }` | Réémet à la room avec `userId` |
| `typing:stop` | `{ conversationId }` | Réémet à la room avec `userId` |

**Serveur → Client :**

| Événement | Payload | Moment |
|---|---|---|
| `presence:snapshot` | `[userId, ...]` | À la connexion initiale |
| `user:online` | `{ userId }` | Quand un user se connecte |
| `user:offline` | `{ userId }` | Quand ses derniers sockets se ferment |
| `message:new` | `{ conversationId, message }` | Après `POST /conversations/:id/messages` |
| `typing:start` | `{ conversationId, userId }` | Relayé depuis le client |
| `typing:stop` | `{ conversationId, userId }` | Relayé depuis le client |
| `notification:new` | `{ ... }` | Disponible, pas encore câblé sur toutes les routes |

### Présence multi-onglets

Un utilisateur peut avoir plusieurs sockets ouverts (plusieurs onglets). La présence utilise `Map<userId, Set<socketId>>` :

```js
// Connexion : ajoute le socketId à l'ensemble
onlineUsers.get(uid).add(socket.id)

// Déconnexion : retire le socketId ; n'émet user:offline que si Set vide
sockets.delete(socket.id)
if (sockets.size === 0) {
  onlineUsers.delete(uid)
  socket.broadcast.emit('user:offline', { userId: uid })
}
```

### Messagerie enrichie

**`GET /api/conversations`** retourne désormais, pour chaque conversation :

```json
{
  "_id": "...",
  "participants": [{ "id": 1, "nom": "Dupont", "prenom": "Jean" }],
  "dernier_message": "Bonjour !",
  "dernier_message_type": "texte",
  "date_dernier_message": "2026-06-09T14:32:00Z",
  "non_lus": 3
}
```

**Non-lus :** champ `lu_par: [Number]` ajouté au schéma `Message`. L'expéditeur est automatiquement dans `lu_par`. L'ouverture d'une conversation (`GET /conversations/:id/messages`) marque tous les messages de l'autre comme lus via `updateMany`.

**`MessagesPage` — améliorations :**
- Timestamp relatif ("à l'instant", "il y a 5 min", "il y a 2h", "il y a 3j")
- Badge rouge en haut avec le total de messages non lus
- Bordure verte sur les cartes avec messages non lus
- Compteur non-lus par conversation (bulle `[1]–[9+]`)
- Aperçu texte du dernier message ou "📷 Photo" si type image
- Mise à jour en temps réel via événement `message:new`

### Photos dans les messages (Cloudinary)

**Backend :**
- `src/config/cloudinary.js` — configure le SDK Cloudinary depuis `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (compte gratuit cloudinary.com)
- `src/middlewares/upload.middleware.js` — `multer` en `memoryStorage`, filtre les types `jpeg/png/webp/gif`, limite 5 Mo
- `POST /api/conversations/:id/messages/media` (multipart, champ `image`) — upload l'image vers le dossier `quartio/messages` sur Cloudinary, crée un `Message` MongoDB `{ type: 'image', media_url }`, enregistre la relation Neo4j `(u)-[:ENVOIE]->(m)-[:CONTENU_DANS]->(c)` et diffuse `message:new` via Socket.io
- Les erreurs Multer (type/taille invalides) sont mappées sur HTTP 400 par `error.middleware.js`

**Frontend (`ConversationPage`) :**
- Bouton 📎 → sélection d'un fichier → `POST .../messages/media` en `FormData`
- Les messages `type: 'image'` sont affichés inline (`<img>` cliquable, ouvre l'original dans un nouvel onglet)
- `MessagesPage` affiche "📷 Photo" comme aperçu du dernier message si `dernier_message_type === 'image'`

### Frontend — `socketStore` (Zustand)

Le store gère la connexion Socket.io et expose :
- `connected` — état de la connexion
- `onlineUsers` — `Set<userId>` des users en ligne
- `isOnline(userId)` — helper booléen
- `joinConversation(id)` / `leaveConversation(id)`
- `emitTypingStart(id)` / `emitTypingStop(id)`

La connexion est initialisée dans `App.jsx` dès que le token JWT est disponible, et déconnectée au logout.

---

## 11. RGPD — Export et suppression de compte

### Vue d'ensemble

Deux routes dédiées dans `src/routes/rgpd.routes.js`, montées sur `/api/rgpd`. Les deux nécessitent un JWT valide.

### 11.1 Export des données — `GET /api/rgpd/export`

Assemble en une seule requête toutes les données personnelles de l'utilisateur depuis les trois bases, puis retourne un fichier JSON téléchargeable.

**Sources interrogées :**

| Base | Données récupérées |
|---|---|
| PostgreSQL | Profil complet, contrats (vendeur ou acheteur), historique transactions, notifications, votes exprimés |
| MongoDB | Annonces, événements, incidents créés, conversations, messages envoyés |
| Neo4j | Toutes les relations sortantes du nœud `Utilisateur` (type, cible, id) |

**Réponse :** header `Content-Disposition: attachment; filename="quartio-mes-donnees-<id>.json"` — le navigateur déclenche le téléchargement directement.

```json
{
  "export_date": "2026-06-09T14:00:00Z",
  "profil": { "id_utilisateur": 1, "nom": "Dupont", ... },
  "contrats": [...],
  "transactions": [...],
  "notifications": [...],
  "votes": [...],
  "annonces": [...],
  "evenements": [...],
  "incidents": [...],
  "conversations": [...],
  "messages": [...],
  "relations_neo4j": [
    { "relation": "HABITE", "cible": ["Quartier"], "cible_pg_id": null, "cible_mongo_id": null },
    { "relation": "UTILISE", "cible": ["Conversation"], "cible_pg_id": null, "cible_mongo_id": "abc123" }
  ]
}
```

**Frontend :** bouton "⬇ Exporter mes données (JSON)" dans la section RGPD du profil. Le téléchargement est déclenché en créant un `Blob` côté client depuis la réponse API (pas de lien externe).

```js
const res = await api.get('/rgpd/export', { responseType: 'blob' })
const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }))
const a   = document.createElement('a')
a.href = url; a.download = `quartio-mes-donnees-${user.id}.json`; a.click()
URL.revokeObjectURL(url)
```

---

### 11.2 Suppression de compte — `DELETE /api/rgpd/delete-account`

Suppression **totale et irréversible** du compte avec confirmation d'identité obligatoire.

**Vérification d'identité :**
- Si `mfa_actif = true` → fournir `{ code: "123456" }` (TOTP vérifié via speakeasy)
- Si `mfa_actif = false` → fournir `{ mot_de_passe: "..." }` (vérifié via bcrypt)

**Cascade de suppression :**

```
1. MongoDB
   ├── Messages      : anonymisés (contenu → "[Message supprimé]", est_supprime = true)
   │                   Les conversations sont conservées pour les autres participants
   ├── Annonces      : supprimées (deleteMany)
   ├── Événements    : supprimés (deleteMany)
   └── Incidents     : supprimés (deleteMany)

2. Neo4j
   └── MATCH (u:Utilisateur {pg_id}) DETACH DELETE u
       → supprime le nœud ET toutes ses relations

3. PostgreSQL
   ├── Contrats      : id_vendeur/id_acheteur mis à NULL (conservation pour intégrité comptable)
   └── DELETE utilisateur WHERE id_utilisateur = uid
       → CASCADE automatique sur :
           refresh_token, email_verification, password_reset,
           notification, transaction_points
```

**Pourquoi anonymiser les messages plutôt que les supprimer ?**
Supprimer les messages d'un utilisateur rendrait les conversations des autres participants incohérentes (trous dans le fil de discussion). L'anonymisation préserve le contexte tout en supprimant le contenu identifiant.

**Pourquoi conserver les contrats ?**
Les contrats représentent des transactions financières (points échangés). Les supprimer compromettrait l'intégrité de l'historique comptable des autres participants. Seule l'identité est effacée (NULL sur `id_vendeur`/`id_acheteur`).

**Frontend — flux en 3 étapes (prévient les clics accidentels) :**

```
Étape 1 : Bouton "Supprimer mon compte"
    ↓
Étape 2 : Écran d'avertissement (conséquences listées) + bouton "Continuer"
    ↓
Étape 3 : Saisie du code MFA ou mot de passe → appel DELETE → logout automatique
```

**Routes :**

| Méthode | Route | Auth | Corps |
|---|---|---|---|
| `GET`    | `/api/rgpd/export`         | JWT | — |
| `DELETE` | `/api/rgpd/delete-account` | JWT | `{ code }` ou `{ mot_de_passe }` |

---

## 12. Événements — Inscription, Swipe Neo4j, Suggestions

### 12.1 Inscription / désinscription (`EvenementDetailPage`)

La page détail affiche désormais un bouton d'action contextuel :

| Cas | Bouton | Action |
|---|---|---|
| Non inscrit, places disponibles | "S'inscrire à cet événement" | `POST /evenements/:id/participer` |
| Inscrit | "✓ Inscrit — Se désinscrire" | `DELETE /evenements/:id/participer` |
| Complet (capacité max atteinte) | "Complet" (désactivé) | — |
| Organisateur | Message "Vous organisez cet événement" | — |

**Barre de capacité :** affiche le taux de remplissage avec couleur progressive (verte → rouge quand complet). Le compteur de participants est mis à jour localement après chaque action sans rechargement.

---

### 12.2 Swipe et enregistrement Neo4j

**Endpoint : `POST /api/evenements/:id/swipe`**

```json
{ "direction": "right" }   // ou "left"
```

Crée une relation dans Neo4j :
- `direction: "right"` → `(Utilisateur)-[:A_AIME]->(Evenement)`
- `direction: "left"`  → `(Utilisateur)-[:A_IGNORE]->(Evenement)`

Utilise `MERGE` pour éviter les doublons. La date d'action est stockée sur la relation (`r.date_action = datetime()`).

**Dans SwipeView :**
- Swipe droite → `POST /participer` + `POST /swipe { direction: "right" }`
- Swipe gauche → `POST /swipe { direction: "left" }` uniquement (pas d'inscription)

---

### 12.3 Moteur de suggestions (Neo4j)

**Endpoint : `GET /api/evenements/suggestions`** (JWT requis)

Requête Cypher collaborative filtering :

```cypher
MATCH (me:Utilisateur {pg_id: $uid})-[:PARTICIPE|A_AIME]->(e1:Evenement)
<-[:PARTICIPE|A_AIME]-(voisin:Utilisateur)-[:PARTICIPE|A_AIME]->(e2:Evenement)
WHERE NOT (me)-[:PARTICIPE|A_AIME]->(e2)
  AND NOT (me)-[:A_IGNORE]->(e2)
RETURN e2.mongo_id AS mongo_id, count(voisin) AS score
ORDER BY score DESC LIMIT 5
```

**Logique :** cherche les utilisateurs ayant participé ou aimé les mêmes événements que moi, puis récupère leurs autres événements que je n'ai pas encore vus ni ignorés. Trie par popularité (nombre de voisins en commun).

**Note de routing :** la route `/suggestions` est déclarée **avant** `/:id` dans le routeur Express pour éviter qu'Express l'interprète comme un paramètre dynamique.

---

## 13. Statistiques backoffice

### 13.1 Endpoint `GET /api/stats`

Accessible aux rôles `admin` et `moderateur`. Agrège en parallèle les données des trois bases.

**Structure de réponse :**

```json
{
  "kpis": {
    "total_utilisateurs": 42,
    "nouveaux_30j": 8,
    "points_en_circulation": 12500,
    "contrats_en_attente": 3,
    "contrats_termines": 17,
    "contrats_annules": 2,
    "taux_completion": 89,
    "total_annonces": 54,
    "total_evenements": 12,
    "total_incidents": 7
  },
  "weekly": [
    { "label": "S-7", "utilisateurs": 2, "annonces": 5, "evenements": 1, "points": 300 },
    ...
  ],
  "ranking": [
    { "id_utilisateur": 1, "prenom": "Jean", "nom": "Dupont", "points_solde": 850, "role": "user" },
    ...
  ],
  "top_categories": [
    { "categorie": "bricolage", "count": 12 },
    ...
  ],
  "incidents_urgents": [ ... ],
  "incidents_by_status": [
    { "statut": "ouvert", "count": 4 },
    ...
  ]
}
```

**Séries hebdomadaires :** 8 semaines glissantes calculées dynamiquement à partir de `NOW()`. Les annonces et événements viennent de MongoDB (`countDocuments` avec filtre sur `date_publication` / `createdAt`), les utilisateurs et points de PostgreSQL.

### 13.2 DashboardPage (backoffice)

Enrichi avec :
- KPIs réels depuis `/stats` (points en circulation, taux complétion, nouveaux ce mois)
- Bloc "Incidents urgents" — liste les 5 incidents `haute`/`critique` non résolus avec badge de priorité coloré
- Indicateurs de statut des services basés sur les données réelles (pas de mock)

### 13.3 StatistiquesPage (backoffice) — nouvelle page

Accessible via `📊 Statistiques` dans la sidebar. Construite avec **Recharts**.

| Graphique | Type | Données |
|---|---|---|
| Activité 8 semaines | BarChart groupé | inscriptions + annonces + événements |
| Points échangés | LineChart | points totaux par semaine |
| Top catégories | PieChart | répartition par catégorie d'annonce |
| Incidents par statut | Barres de progression | ouvert / en_cours / résolu / fermé |
| Classement utilisateurs | Tableau | top 10 avec médailles 🥇🥈🥉 |

---

## 14. SSO token Java Desktop

**Endpoint : `GET /api/auth/sso-token`** (JWT requis)

Génère un token JWT distinct du token d'accès normal :

```json
{ "sso_token": "eyJ...", "expires_in": 300 }
```

**Différences avec le JWT d'accès :**

| Propriété | Access token | SSO token |
|---|---|---|
| Durée | 1h | 5 min |
| Champ `type` | — | `"sso"` |
| Usage | Toutes les routes API | Authentification initiale Java Desktop |

**Flux d'utilisation côté Java :**
1. L'utilisateur est connecté sur le web (access_token valide)
2. Le frontend appelle `GET /api/auth/sso-token` → reçoit le `sso_token`
3. Le SSO token est transmis à l'app Java (QR code, deep link, presse-papier)
4. L'app Java l'utilise pour s'authentifier sur l'API dans les 5 minutes

Le `sso_token` accepte les mêmes middlewares `auth` que le token normal (même clé de vérification `JWT_SECRET`). La distinction par `type: 'sso'` peut être utilisée pour des restrictions supplémentaires si nécessaire.

---

## 15. Alertes temps réel (Socket.io)

### Architecture

Les alertes sont un canal distinct du chat. Elles sont émises depuis les controllers backend via `emitAlert()` et reçues par le frontend via des événements Socket.io dédiés.

```js
// src/socket/index.js
function emitAlert(type, payload, targetUserIds = null) {
  const event = `alert:${type}`;
  if (targetUserIds) {
    // Alerte ciblée : uniquement aux sockets des utilisateurs listés
    targetUserIds.forEach((uid) => {
      const sockets = onlineUsers.get(uid);
      if (sockets) sockets.forEach((sid) => io.to(sid).emit(event, payload));
    });
  } else {
    // Broadcast à tous les connectés
    io.emit(event, payload);
  }
}
```

### Événements émis

| Événement | Déclencheur | Cible | Payload |
|---|---|---|---|
| `alert:incident` | Création incident `haute`/`critique` | Broadcast | `{ id, titre, priorite, statut }` |
| `alert:contrat` | Signature d'une partie → autre en attente | Ciblé (signataire attendant) | `{ id_contrat, message }` |
| `alert:vote` | Création d'un nouveau vote | Broadcast | `{ id_vote, titre, type_vote }` |

### Frontend

`socketStore.js` écoute les 4 événements (`alert:incident`, `alert:contrat`, `alert:vote`, `alert:evenement`) et les empile dans `alerts[]` (max 10, du plus récent au plus ancien).

`AlertBanner.jsx` — bandeau affiché sous la topbar dans le Layout frontoffice :
- Couleur contextuelle : rouge (incident), amber (contrat), indigo (vote), vert (événement)
- Icône et label par type
- Bouton `×` pour fermer chaque alerte individuellement
- Disparaît automatiquement quand le tableau `alerts` est vide

---

## 16. Votes paramétrables

### Migration SQL

```sql
ALTER TABLE vote ADD COLUMN IF NOT EXISTS type_vote VARCHAR(20) DEFAULT 'choix_multiple'
  CHECK (type_vote IN ('choix_multiple', 'oui_non', 'classement'));
ALTER TABLE vote ADD COLUMN IF NOT EXISTS nb_choix_max INTEGER DEFAULT 1;
```

### Types de votes

| `type_vote` | Description | Comportement |
|---|---|---|
| `choix_multiple` | Défaut — choisir une option parmi N | Options définies par le créateur, vote par clic |
| `oui_non` | Réponse binaire | Options "Oui"/"Non" générées automatiquement côté backend (aucune option à passer dans le payload) |
| `classement` | Ordonner par préférence | UI ↑/↓ pour classer les options, soumission de l'ordre complet |

### Backend — création

```js
// votes.controller.js
const typeVote = type_vote || 'choix_multiple';
const optionsToInsert = typeVote === 'oui_non'
  ? [{ libelle: 'Oui', ordre: 0 }, { libelle: 'Non', ordre: 1 }]
  : (rawOptions ?? []);
```

Pour `oui_non`, le frontend n'a pas besoin d'envoyer le champ `options` — le backend les génère.

### Frontend — VotesPage

**Formulaire de création :** 3 boutons de type, formulaire d'options masqué pour `oui_non`, note explicative pour `classement`.

**Affichage :**
- `choix_multiple` / `oui_non` : boutons cliquables avec barre de progression après vote
- `classement` : liste ordonnée avec boutons ↑/↓, bouton "Valider mon classement", soumission via `POST /votes/:id/voter` avec `{ classement: [id1, id2, ...] }`
- Badge de type visible sur chaque carte de vote

---

## 17. Rôle modérateur (backoffice)

### Accès

Le backoffice accepte désormais deux rôles : `admin` et `moderateur`.

**`authStore.js` (backoffice) :**
```js
if (!['admin', 'moderateur'].includes(data.utilisateur?.role)) {
  set({ error: 'Accès réservé aux administrateurs et modérateurs.' })
  return false
}
```

### Sidebar filtrée par rôle

Chaque lien de la sidebar a une propriété `roles` optionnelle. Si absente, le lien est visible par tous les rôles autorisés. Si présente, seuls les rôles listés peuvent le voir.

```js
const ALL_LINKS = [
  { to: '/dashboard',    icon: '⊞',  label: 'Dashboard' },              // visible par tous
  { to: '/statistiques', icon: '📊', label: 'Statistiques', roles: ['admin'] },
  { to: '/console',      icon: '💻', label: 'Console QL',   roles: ['admin'] },
  { to: '/utilisateurs', icon: '👥', label: 'Utilisateurs', roles: ['admin'] },
  { to: '/quartiers',    icon: '🗺️', label: 'Quartiers',    roles: ['admin'] },
  { to: '/incidents',    icon: '⚠️', label: 'Incidents' },               // visible par tous
  { to: '/annonces',     icon: '📋', label: 'Annonces' },                // visible par tous
  { to: '/contrats',     icon: '📄', label: 'Contrats',     roles: ['admin'] },
  ...
]
const links = ALL_LINKS.filter((l) => !l.roles || l.roles.includes(admin?.role))
```

**Ce que voit un modérateur :** Dashboard, Incidents, Annonces.

**Ce que voit un admin :** tout.

### Badge de rôle

Un badge coloré dans la sidebar identifie le rôle connecté :
- Indigo : `Administrateur`
- Amber : `Modérateur`

### Permissions API du modérateur

Le middleware `role('admin', 'moderateur')` (`src/middlewares/role.middleware.js`) est appliqué sur les routes que le modérateur doit pouvoir utiliser :

| Route | Accès |
|---|---|
| `GET /api/incidents` | `admin`, `moderateur` |
| `PUT /api/incidents/:id` | `admin`, `moderateur` (changement de statut) |
| `DELETE /api/incidents/:id` | `admin` uniquement |
| `POST /api/messages/:id/avertir` | `admin`, `moderateur` |
| `DELETE /api/messages/:id` | auteur du message, `admin`, `moderateur` |
| `POST /api/query` (Quartio-QL) | `admin`, `moderateur` (FIND/COUNT seulement) |

### Signalements de messages — `SignalementsPage`

**Signaler un message (Frontoffice) :** dans `ConversationPage`, un bouton ⚑ apparaît au survol de chaque message reçu → `POST /api/messages/:id/signaler`. Cela crée un document `Incident` MongoDB avec `id_message` renseigné et la relation Neo4j `(m:Message)-[:SIGNALE]->(i:Incident)`.

**Traiter les signalements (Backoffice) :**
- `GET /api/incidents?signalements=true` — le contrôleur `incidents.controller.js` filtre les incidents où `id_message` existe, `populate()` le message associé et enrichit chaque entrée avec `message_auteur` (nom/prénom récupérés en PostgreSQL). La liste `getAll` par défaut (sans ce paramètre) exclut ces entrées (`id_message: { $exists: false }`).
- `Backoffice/src/pages/SignalementsPage.jsx` affiche pour chaque signalement : auteur, contenu (ou aperçu image), motif, date, avec trois actions :
  - **Supprimer le message** → `DELETE /api/messages/:id` (soft delete, `est_supprime = true`) puis `PUT /api/incidents/:id { statut: 'resolu' }`
  - **Avertir** → `POST /api/messages/:id/avertir` (crée une notification "Avertissement de la modération" pour l'auteur) puis `PUT /api/incidents/:id { statut: 'resolu' }`
  - **Ignorer** → `PUT /api/incidents/:id { statut: 'ferme' }`
- Lien `/signalements` visible dans la sidebar pour `admin` et `moderateur`.

---

## 18. Langage d'interrogation Quartio-QL

Le langage maison d'interrogation MongoDB est documenté dans deux fichiers dédiés :

- **`QUARTIO-QL.md`** — documentation technique ligne par ligne : architecture 4 couches, lexer (tokens, word boundaries), parser (règles CstParser, lookahead), transpileur (CST → filtre Mongoose, priorité AND/OR), controller (sécurité, whitelist collections), route.
- **`QUARTIO-QL-COURS.md`** — cours d'utilisation : syntaxe des 5 commandes (FIND, COUNT, INSERT, UPDATE, DELETE), opérateurs, types de valeurs, exemples progressifs, exercices avec corrections, guide des messages d'erreur.

### Fichiers

```
api-rest-pa/src/lang/
  ├── lexer.js       — 17 tokens Chevrotain avec word boundaries
  ├── parser.js      — CstParser avec 12 règles de grammaire
  ├── transpiler.js  — CST → { filter, sort, limit } Mongoose
  └── index.js       — pipeline tokenize → parse → transpile

api-rest-pa/src/controllers/query.controller.js  — exécution + sécurité
api-rest-pa/src/routes/query.routes.js           — POST /api/query (admin + moderateur)
Backoffice/src/pages/ConsolePage.jsx             — interface console backoffice
```

### Collections accessibles

`annonces`, `evenements`, `incidents`, `conversations`, `messages` (singulier et pluriel acceptés).

### Sécurité

| Protection | Détail |
|---|---|
| Authentification | JWT obligatoire, rôles `admin` ou `moderateur` |
| Modérateurs | FIND et COUNT uniquement (pas d'INSERT/UPDATE/DELETE) |
| UPDATE/DELETE sans WHERE | Bloqués (HTTP 400) |
| Résultats massifs | Limite par défaut 50, plafond à 200 |
| Injection MongoDB | Impossible — seuls identifiants et littéraux acceptés par la grammaire |

---

## 19. Documentation Swagger

### Accès

```
http://localhost:3000/api/docs/
```

### Couverture

| Tag | Endpoints |
|---|---|
| Auth | 11 |
| Auth/MFA | 5 |
| RGPD | 2 |
| Stats | 1 |
| Utilisateurs | 9 |
| Quartiers | 8 |
| Annonces | 7 |
| Événements | 11 |
| Votes | 7 |
| Conversations | 5 |
| Messages | 2 |
| Contrats | 6 |
| Transactions | 2 |
| Incidents | 5 |
| Notifications | 4 |
| Console/QL | 1 |
| **Total** | **86 endpoints** |

### Schémas définis

20 schémas réutilisables dans `components.schemas` :

`PaginatedResponse`, `Error`, `LoginResponse`, `UtilisateurPublic`, `UtilisateurCreate`, `UtilisateurUpdate`, `Quartier`, `QuartierCreate`, `Annonce`, `AnnonceCreate`, `Evenement`, `EvenementCreate`, `Vote`, `VoteCreate`, `Contrat`, `Conversation`, `Message`, `Incident`, `Transaction`, `Notification`

### Conventions

- Routes publiques (sans JWT) : `security: []` explicitement
- Routes MFA post-login (`/auth/mfa/verify`) : `security: []` — utilise `mfa_token` dans le body
- Routes RGPD : JWT obligatoire, pas de rôle admin requis (chaque utilisateur accède à ses propres données)
- Routes admin : mentionnées dans `description`
- Réponses d'erreur : codes HTTP 400, 403, 404, 409, 422 documentés avec leurs causes
- Pagination : toutes les listes utilisent `$ref: PaginatedResponse` + override du champ `data`
- Routes MFA : montées sur `/api/auth/mfa/*` via `mfa.routes.js`
- Routes RGPD : montées sur `/api/rgpd/*` via `rgpd.routes.js`
- Routes Stats : montées sur `/api/stats` via `stats.routes.js`
- Route `/api/evenements/suggestions` déclarée avant `/:id` pour éviter le conflit de routing Express
- Routes QL : montées sur `/api/query` via `query.routes.js`, accessibles admin + moderateur
