# Documentation technique — Quartio

## Sommaire

1. [Architecture générale](#1-architecture-générale)
2. [Infrastructure Docker](#2-infrastructure-docker)
3. [Backend — api-rest-pa](#3-backend--api-rest-pa)
4. [Frontoffice](#4-frontoffice)
5. [Backoffice — CRUD des sections](#5-backoffice--crud-des-sections)
6. [Backoffice — Gestion des quartiers sur carte](#6-backoffice--gestion-des-quartiers-sur-carte)

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
