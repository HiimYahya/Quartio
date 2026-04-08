# Neo4j — Référence des relations (MCD → Graphe)

Chaque relation du MCD devient une arête dans Neo4j.
Les nœuds stockent uniquement l'ID de référence (pg_id ou mongo_id).

## Relations

| Relation Cypher | MCD | Propriétés |
|---|---|---|
| `(:Utilisateur)-[:HABITE]->(:Quartier)` | HABITE | — |
| `(:Utilisateur)-[:ADMINISTRE]->(:Quartier)` | ADMINISTRE | — |
| `(:Utilisateur)-[:ORGANISE]->(:Evenement)` | ORGANISE | — |
| `(:Utilisateur)-[:PARTICIPE]->(:Evenement)` | PARTICIPE | `statut_participation`, `date_action` |
| `(:Utilisateur)-[:CREE]->(:Vote)` | CREE | — |
| `(:Utilisateur)-[:REPOND]->(:OptionVote)` | REPOND | `date_vote` |
| `(:Utilisateur)-[:SIGNE]->(:Contrat)` | SIGNE | — |
| `(:Utilisateur)-[:UTILISE]->(:Conversation)` | UTILISE | — |
| `(:Utilisateur)-[:ENVOIE]->(:Message)` | ENVOIE | — |
| `(:Annonce)-[:APPARTIENT]->(:Quartier)` | APPARTIENT | — |
| `(:Evenement)-[:TIENT_DANS]->(:Quartier)` | TIENT_DANS | — |
| `(:Annonce)-[:GENERE]->(:Contrat)` | GENERE | — |
| `(:Contrat)-[:LIE_A]->(:Transaction)` | LIE_A | — |
| `(:Transaction)-[:EST_POUR]->(:Utilisateur)` | EST_POUR | `type` |
| `(:Message)-[:CONTENU_DANS]->(:Conversation)` | CONTIENT_MSG | — |
| `(:Message)-[:SIGNALE]->(:Incident)` | SIGNALE | — |
| `(:Annonce)-[:PORTE_SUR]->(:Evenement)` | PORTE_SUR | — |
| `(:Vote)-[:COMPOSE]->(:Theme)` | COMPOSE | — |
| `(:Annonce)-[:CONCERNE]->()` | CONCERNE | `type` |

## Exemple de requêtes utiles

```cypher
-- Tous les quartiers où habite un utilisateur
MATCH (u:Utilisateur {pg_id: 1})-[:HABITE]->(q:Quartier)
RETURN q

-- Événements auxquels participe un utilisateur
MATCH (u:Utilisateur {pg_id: 1})-[p:PARTICIPE]->(e:Evenement)
RETURN e.mongo_id, p.statut_participation

-- Utilisateurs dans le même quartier (voisins)
MATCH (u1:Utilisateur {pg_id: 1})-[:HABITE]->(q:Quartier)<-[:HABITE]-(u2:Utilisateur)
WHERE u1 <> u2
RETURN u2.pg_id

-- Réseau social d'un utilisateur (conversations communes)
MATCH (u1:Utilisateur {pg_id: 1})-[:UTILISE]->(c:Conversation)<-[:UTILISE]-(u2:Utilisateur)
RETURN DISTINCT u2.pg_id
```
