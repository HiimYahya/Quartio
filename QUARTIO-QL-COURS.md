# Cours — Quartio-QL, le langage d'interrogation de Quartio

---

## À qui s'adresse ce cours ?

Ce cours s'adresse à toute personne souhaitant interroger la base de données MongoDB de Quartio depuis la **console d'administration** (`/console` dans le backoffice). Aucune connaissance de MongoDB ou de SQL n'est requise : on part de zéro.

À la fin de ce cours, vous serez capable d'écrire des requêtes pour :
- chercher des documents,
- les filtrer avec des conditions simples ou combinées,
- les trier,
- les compter,
- en insérer, en modifier ou en supprimer.

---

## Avant de commencer

### Qu'est-ce qu'une requête ?

Une requête est une instruction que vous donnez à la base de données. Elle décrit **ce que vous voulez**, et la base de données vous répond avec les données correspondantes. Quartio-QL est le langage dans lequel vous rédigez ces instructions.

### Où écrire des requêtes ?

Dans le backoffice, section **💻 Console QL**. Vous tapez votre requête dans la zone sombre, puis appuyez sur `Ctrl + Entrée` (ou le bouton **▶ Exécuter**).

### Sur quoi peut-on interroger ?

Quartio-QL donne accès à cinq **collections** (équivalent des tables en SQL) :

| Nom à utiliser | Ce que ça contient |
|---|---|
| `annonces` | Les annonces de services publiées par les habitants |
| `evenements` | Les événements organisés dans les quartiers |
| `incidents` | Les signalements d'incidents |
| `conversations` | Les fils de messagerie entre voisins |
| `messages` | Les messages individuels dans les conversations |

Vous pouvez écrire le nom au singulier (`annonce`) ou au pluriel (`annonces`) : les deux fonctionnent.

---

## Partie 1 — Récupérer des données avec FIND

### 1.1 La requête la plus simple

```
FIND annonces
```

Cette requête retourne les **50 premières annonces** de la base (50 est la limite par défaut). Aucun filtre, aucun tri : on récupère tout.

**Résultat :** un tableau de documents, chacun représentant une annonce avec ses champs (`titre`, `statut`, `cout_points`, etc.).

---

### 1.2 Limiter le nombre de résultats avec LIMIT

Si vous ne voulez que les 5 premières annonces :

```
FIND annonces LIMIT 5
```

La limite maximale autorisée est **200**. Si vous écrivez `LIMIT 500`, Quartio-QL retournera quand même 200 résultats au plus.

---

### 1.3 Filtrer avec WHERE

`WHERE` permet de ne retourner que les documents qui satisfont une condition.

**Exemple : toutes les annonces actives**

```
FIND annonces WHERE statut = "active"
```

Le nom du champ (`statut`) vient en premier, suivi de l'opérateur (`=`), puis de la valeur (`"active"` entre guillemets car c'est du texte).

**Règle importante :** les valeurs texte doivent être entre guillemets doubles `"..."` ou simples `'...'`. Les nombres s'écrivent sans guillemets.

```
FIND annonces WHERE cout_points > 50
```

Retourne toutes les annonces dont le coût en points est supérieur à 50.

---

### 1.4 Les opérateurs de comparaison

| Opérateur | Signification | Exemple |
|---|---|---|
| `=`  | Égal à | `statut = "active"` |
| `!=` | Différent de | `statut != "archivee"` |
| `>`  | Supérieur à | `cout_points > 100` |
| `<`  | Inférieur à | `cout_points < 10` |
| `>=` | Supérieur ou égal | `cout_points >= 50` |
| `<=` | Inférieur ou égal | `cout_points <= 200` |

**Exemples :**

```
FIND annonces WHERE cout_points >= 100
```

```
FIND incidents WHERE priorite != "basse"
```

---

### 1.5 Les types de valeurs

Quartio-QL reconnaît quatre types de valeurs :

**Texte** — entre guillemets :
```
FIND annonces WHERE statut = "active"
FIND annonces WHERE type = 'offre'
```

**Nombre** — sans guillemets :
```
FIND annonces WHERE cout_points > 50
FIND annonces WHERE cout_points = 0
FIND annonces WHERE cout_points >= 10.5
```

**Booléen** — `true` ou `false` sans guillemets :
```
FIND annonces WHERE est_payant = true
FIND annonces WHERE est_payant = false
```

**Null** — pour les champs vides ou absents :
```
FIND annonces WHERE categorie = null
```

---

### 1.6 Trier avec ORDER BY

```
FIND annonces WHERE statut = "active" ORDER BY date_publication DESC
```

- `ASC` : ordre croissant (du plus ancien au plus récent, de A à Z, du plus petit au plus grand).
- `DESC` : ordre décroissant (du plus récent au plus ancien).

Si vous omettez `ASC` ou `DESC`, le tri est croissant par défaut.

```
FIND evenements WHERE statut = "planifie" ORDER BY date_debut ASC LIMIT 5
```

Retourne les 5 prochains événements planifiés, du plus proche au plus loin dans le temps.

---

### 1.7 Combiner WHERE, ORDER BY et LIMIT

Ces trois clauses peuvent s'utiliser ensemble dans cet **ordre précis** :

```
FIND <collection> WHERE <conditions> ORDER BY <champ> ASC|DESC LIMIT <n>
```

**Exemple complet :**

```
FIND annonces WHERE est_payant = true ORDER BY cout_points DESC LIMIT 10
```

Retourne les 10 annonces payantes les plus chères.

---

## Partie 2 — Conditions avancées

### 2.1 Combiner des conditions avec AND et OR

**AND** : les deux conditions doivent être vraies simultanément.

```
FIND annonces WHERE statut = "active" AND est_payant = true
```

Retourne les annonces qui sont à la fois actives **et** payantes.

**OR** : au moins l'une des conditions doit être vraie.

```
FIND incidents WHERE priorite = "haute" OR priorite = "critique"
```

Retourne les incidents de priorité haute **ou** critique.

**Combiner AND et OR :** AND est prioritaire sur OR, comme en mathématiques `×` est prioritaire sur `+`.

```
FIND annonces WHERE cout_points > 50 AND statut = "active" OR cout_points = 0 AND est_payant = false
```

Ceci est interprété comme :
```
(cout_points > 50 AND statut = "active")
OR
(cout_points = 0 AND est_payant = false)
```

---

### 2.2 Recherche de texte avec CONTAINS

`CONTAINS` cherche si un champ contient une sous-chaîne, **sans tenir compte des majuscules/minuscules**.

```
FIND incidents WHERE titre CONTAINS "bruit"
```

Retourne les incidents dont le titre contient le mot "bruit" : "Bruit de voisinage", "BRUIT nocturne", "bruit excessif", etc.

```
FIND annonces WHERE description CONTAINS "guitare"
```

Pratique pour faire une recherche plein-texte approximative.

---

### 2.3 Filtrer sur une liste de valeurs avec IN

`IN` permet de vérifier si un champ fait partie d'une liste de valeurs. C'est plus concis que d'écrire plusieurs `OR`.

```
FIND annonces WHERE statut IN ("active", "inactive")
```

Équivaut à :
```
FIND annonces WHERE statut = "active" OR statut = "inactive"
```

On peut mettre autant de valeurs qu'on veut dans la liste :

```
FIND incidents WHERE priorite IN ("haute", "critique") LIMIT 20
```

**NOT IN** — l'inverse : retourne les documents dont le champ n'est dans aucune des valeurs listées.

```
FIND annonces WHERE statut NOT IN ("archivee", "inactive")
```

---

### 2.4 Exemples récapitulatifs

**Les annonces de jardinage avec un coût entre 20 et 100 points :**
```
FIND annonces WHERE categorie = "jardinage" AND cout_points >= 20 AND cout_points <= 100
```

**Les incidents ouverts ou en cours, par priorité décroissante :**
```
FIND incidents WHERE statut IN ("ouvert", "en_cours") ORDER BY priorite DESC LIMIT 50
```

**Les événements qui parlent de marché :**
```
FIND evenements WHERE titre CONTAINS "marché" ORDER BY date_debut ASC LIMIT 10
```

---

## Partie 3 — Compter des documents avec COUNT

Plutôt que de récupérer les documents, `COUNT` retourne simplement **combien** il y en a.

### 3.1 Compter tous les documents d'une collection

```
COUNT incidents
```

Retourne un nombre, par exemple : `7`.

### 3.2 Compter avec un filtre

```
COUNT incidents WHERE statut = "ouvert"
```

```
COUNT annonces WHERE est_payant = true AND statut = "active"
```

`COUNT` accepte exactement les mêmes conditions que `FIND` — il retourne simplement le nombre au lieu des documents eux-mêmes.

### 3.3 Quand utiliser COUNT plutôt que FIND ?

- Quand vous voulez juste vérifier un chiffre (ex: "combien d'incidents critiques en ce moment ?") sans avoir besoin de voir le contenu.
- `COUNT` est plus rapide que `FIND` car il n'a pas à transférer les données.

---

## Partie 4 — Insérer des documents avec INSERT

`INSERT` crée un nouveau document dans une collection.

### 4.1 Syntaxe

```
INSERT <collection> { "champ": valeur, "champ2": valeur2, ... }
```

### 4.2 Exemples

**Créer un incident :**
```
INSERT incidents { "titre": "Lampadaire cassé", "priorite": "normale", "statut": "ouvert", "description": "Le lampadaire devant le n°12 est hors service." }
```

**Créer une annonce :**
```
INSERT annonces { "titre": "Cours de piano", "type": "offre", "est_payant": true, "cout_points": 30, "statut": "active" }
```

### 4.3 Règles pour les clés

Les clés peuvent s'écrire avec ou sans guillemets :
```
INSERT incidents { titre: "Test", priorite: "basse" }
INSERT incidents { "titre": "Test", "priorite": "basse" }
```

Les deux formes sont équivalentes.

### 4.4 Ce que retourne INSERT

Un objet contenant le document créé avec son identifiant MongoDB (`_id`) généré automatiquement.

---

## Partie 5 — Modifier des documents avec UPDATE

`UPDATE` modifie les documents qui correspondent à un filtre.

### 5.1 Syntaxe

```
UPDATE <collection> WHERE <conditions> SET { "champ": nouvelle_valeur }
```

### 5.2 Exemples

**Archiver toutes les annonces inactives :**
```
UPDATE annonces WHERE statut = "inactive" SET { "statut": "archivee" }
```

**Marquer un incident comme résolu :**
```
UPDATE incidents WHERE statut = "en_cours" AND titre CONTAINS "lampadaire" SET { "statut": "resolu" }
```

**Modifier le coût d'annonces d'une catégorie :**
```
UPDATE annonces WHERE categorie = "jardinage" AND cout_points < 10 SET { "cout_points": 10 }
```

### 5.3 Ce que retourne UPDATE

```json
{ "matched": 3, "modified": 3 }
```

- `matched` : nombre de documents qui correspondaient au filtre.
- `modified` : nombre de documents effectivement modifiés (peut être inférieur à `matched` si certains avaient déjà la valeur cible).

### 5.4 Règle de sécurité

`UPDATE` **sans clause WHERE est interdit**. Cette protection évite de modifier accidentellement tous les documents d'une collection.

```
UPDATE annonces SET { "statut": "archivee" }
```

→ ❌ Erreur : `UPDATE sans clause WHERE est interdit`

---

## Partie 6 — Supprimer des documents avec DELETE

`DELETE` supprime définitivement les documents qui correspondent à un filtre.

### 6.1 Syntaxe

```
DELETE <collection> WHERE <conditions>
```

### 6.2 Exemples

**Supprimer les incidents fermés :**
```
DELETE incidents WHERE statut = "ferme"
```

**Supprimer les annonces archivées avec 0 points :**
```
DELETE annonces WHERE statut = "archivee" AND cout_points = 0
```

### 6.3 Ce que retourne DELETE

```json
{ "deleted": 5 }
```

### 6.4 Règle de sécurité

Comme `UPDATE`, `DELETE` **sans clause WHERE est interdit**. La suppression de tous les documents d'une collection est une opération trop risquée pour être autorisée sans filtre explicite.

```
DELETE incidents
```

→ ❌ Erreur : `DELETE sans clause WHERE est interdit`

### 6.5 Attention : la suppression est irréversible

Il n'y a pas de corbeille. Un document supprimé est définitivement perdu. Utilisez `COUNT` ou `FIND` avec le même filtre avant d'exécuter un `DELETE` pour vérifier le nombre et le contenu des documents concernés.

---

## Partie 7 — Référence rapide

### Syntaxe complète de chaque commande

```
FIND   <collection> [WHERE <cond>] [ORDER BY <champ> ASC|DESC] [LIMIT n]
COUNT  <collection> [WHERE <cond>]
INSERT <collection> { "clé": valeur, ... }
UPDATE <collection> WHERE <cond> SET { "clé": valeur, ... }
DELETE <collection> WHERE <cond>
```

### Opérateurs disponibles

| Opérateur | Exemple | Signification |
|---|---|---|
| `=` | `statut = "active"` | Égalité exacte |
| `!=` | `statut != "archivee"` | Différent de |
| `>` | `cout_points > 50` | Strictement supérieur |
| `<` | `cout_points < 10` | Strictement inférieur |
| `>=` | `cout_points >= 50` | Supérieur ou égal |
| `<=` | `cout_points <= 200` | Inférieur ou égal |
| `CONTAINS` | `titre CONTAINS "bruit"` | Contient (insensible à la casse) |
| `IN` | `statut IN ("active", "inactive")` | Appartient à la liste |
| `NOT IN` | `statut NOT IN ("archivee")` | N'appartient pas à la liste |

### Connecteurs logiques

| Connecteur | Priorité | Exemple |
|---|---|---|
| `AND` | Haute (comme `×`) | `a = 1 AND b = 2` |
| `OR` | Basse (comme `+`) | `a = 1 OR b = 2` |

### Collections et champs courants

**annonces** : `titre`, `description`, `type` (offre/demande), `statut` (active/inactive/archivee), `est_payant`, `cout_points`, `categorie`, `id_utilisateur_pg`, `date_publication`

**evenements** : `titre`, `description`, `lieu`, `statut` (planifie/en_cours/termine/annule), `capacite_max`, `date_debut`, `date_fin`, `id_utilisateur_pg`

**incidents** : `titre`, `description`, `type`, `priorite` (basse/normale/haute/critique), `statut` (ouvert/en_cours/resolu/ferme), `id_utilisateur_pg`

**conversations** : `type` (privee/groupe), `nom`, `participants_pg`, `date_creation`

**messages** : `type` (texte/image), `contenu`, `id_utilisateur_pg`, `est_supprime`, `date_envoi`

---

## Partie 8 — Exercices pratiques

### Exercice 1 — Exploration

Exécutez ces requêtes et observez les résultats :

1. Récupérez les 3 derniers incidents créés (tri par date décroissante).
2. Comptez combien d'annonces sont actuellement actives.
3. Trouvez toutes les annonces dont le titre contient "aide".

### Exercice 2 — Filtres combinés

Écrivez les requêtes suivantes :

1. Les événements planifiés ou en cours, triés par date de début croissante, limités à 10.
2. Les annonces payantes avec un coût entre 50 et 150 points.
3. Les incidents critiques ou hauts qui ne sont pas encore résolus ni fermés.

<details>
<summary>Corrections</summary>

```
FIND evenements WHERE statut IN ("planifie", "en_cours") ORDER BY date_debut ASC LIMIT 10
```

```
FIND annonces WHERE est_payant = true AND cout_points >= 50 AND cout_points <= 150
```

```
FIND incidents WHERE priorite IN ("critique", "haute") AND statut NOT IN ("resolu", "ferme")
```

</details>

### Exercice 3 — Modification sécurisée

Avant d'exécuter une modification, vérifiez toujours ce que vous allez toucher :

**Étape 1 :** affichez les documents que vous allez modifier.
```
FIND annonces WHERE statut = "inactive" LIMIT 5
```

**Étape 2 :** comptez-les pour confirmer.
```
COUNT annonces WHERE statut = "inactive"
```

**Étape 3 :** si le résultat est cohérent, effectuez la modification.
```
UPDATE annonces WHERE statut = "inactive" SET { "statut": "archivee" }
```

Ce procédé en 3 étapes est une bonne pratique à toujours suivre avant un `UPDATE` ou un `DELETE`.

---

## Partie 9 — Comprendre les erreurs

### "Erreur de tokenisation à la position X"

Le caractère à cette position n'est pas reconnu par le langage. Vérifiez :
- Avez-vous utilisé un caractère spécial non supporté (`@`, `#`, `%`) ?
- Les guillemets sont-ils bien fermés ?

### "Erreur de syntaxe : Expecting token of type X but found Y"

La structure de la requête ne correspond pas à la grammaire. Exemples courants :

| Erreur | Cause probable |
|---|---|
| `Expecting Identifier but found Where` | Nom de collection manquant : `FIND WHERE` au lieu de `FIND annonces WHERE` |
| `Expecting NumberLiteral but found ...` | `LIMIT` sans nombre : `FIND annonces LIMIT` |
| `Expecting RCurly but found ...` | Accolade fermante manquante dans un INSERT/UPDATE |

### "Collection inconnue"

Le nom de collection n'est pas dans la liste autorisée. Vérifiez l'orthographe. Les collections disponibles sont : `annonces`, `evenements`, `incidents`, `conversations`, `messages`.

### "UPDATE sans clause WHERE est interdit"

Ajoutez un filtre `WHERE`. Si vous voulez vraiment modifier tous les documents, écrivez une condition qui est toujours vraie, par exemple `WHERE statut != "____impossible____"` — mais réfléchissez bien avant de le faire.

---

## Récapitulatif

Quartio-QL est un langage simple, structuré en cinq commandes (`FIND`, `COUNT`, `INSERT`, `UPDATE`, `DELETE`). Chaque commande suit une syntaxe fixe que vous pouvez mémoriser en quelques minutes. La console du backoffice vous propose des exemples pré-remplis pour démarrer rapidement.

Les deux règles de sécurité à retenir :
1. `UPDATE` et `DELETE` **exigent toujours un filtre WHERE**.
2. Utilisez `COUNT` puis `FIND` **avant** d'exécuter un `UPDATE` ou un `DELETE` pour vérifier ce que vous allez modifier.
