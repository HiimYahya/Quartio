# Suivi d'implémentation des ressources

> Mise à jour au fur et à mesure. Cocher chaque case quand la ressource est terminée et testée.

---

## Légende
- ✅ Terminé et testé
- 🔄 En cours
- ❌ À faire

---

## Infrastructure
| Élément | Statut | Fichiers |
|---|---|---|
| Docker (PostgreSQL + MongoDB + Neo4j) | ✅ | `docker-compose.yml`, `Dockerfile` |
| Schéma PostgreSQL | ✅ | `sql/01_schema.sql` |
| Seed PostgreSQL | ✅ | `sql/02_seed.sql` |
| Modèles Mongoose | ✅ | `src/models/mongo/*.model.js` |
| Contraintes Neo4j | ✅ | `neo4j/01_constraints.cypher` |
| Config BDD (pg, mongo, neo4j) | ✅ | `src/config/` |
| Middlewares (auth, role, validate, error) | ✅ | `src/middlewares/` |
| Authentification (register, login, /me) | ✅ | `src/routes/auth.routes.js`, `src/controllers/auth.controller.js` |

---

## Ressources API

### 1. Quartiers
| Élément | Statut |
|---|---|
| `src/routes/quartiers.routes.js` | ✅ |
| `src/controllers/quartiers.controller.js` | ✅ |
| `src/validators/quartier.validator.js` | ✅ |
| Branché dans `routes/index.js` | ✅ |

### 2. Utilisateurs
| Élément | Statut |
|---|---|
| `src/routes/utilisateurs.routes.js` | ✅ |
| `src/controllers/utilisateurs.controller.js` | ✅ |
| `src/validators/utilisateur.validator.js` | ✅ |
| Branché dans `routes/index.js` | ✅ |

### 3. Annonces
| Élément | Statut |
|---|---|
| `src/routes/annonces.routes.js` | ✅ |
| `src/controllers/annonces.controller.js` | ✅ |
| `src/validators/annonce.validator.js` | ✅ |
| Branché dans `routes/index.js` | ✅ |

### 4. Événements
| Élément | Statut |
|---|---|
| `src/routes/evenements.routes.js` | ✅ |
| `src/controllers/evenements.controller.js` | ✅ |
| `src/validators/evenement.validator.js` | ✅ |
| Branché dans `routes/index.js` | ✅ |

### 5. Votes
| Élément | Statut |
|---|---|
| `src/routes/votes.routes.js` | ✅ |
| `src/controllers/votes.controller.js` | ✅ |
| `src/validators/vote.validator.js` | ✅ |
| Branché dans `routes/index.js` | ✅ |

### 6. Conversations
| Élément | Statut |
|---|---|
| `src/routes/conversations.routes.js` | ✅ |
| `src/controllers/conversations.controller.js` | ✅ |
| `src/validators/conversation.validator.js` | ✅ |
| Branché dans `routes/index.js` | ✅ |

### 7. Messages
| Élément | Statut |
|---|---|
| `src/routes/messages.routes.js` | ✅ |
| `src/controllers/messages.controller.js` | ✅ |
| Branché dans `routes/index.js` | ✅ |

### 8. Contrats
| Élément | Statut |
|---|---|
| `src/routes/contrats.routes.js` | ✅ |
| `src/controllers/contrats.controller.js` | ✅ |
| `src/validators/contrat.validator.js` | ✅ |
| Branché dans `routes/index.js` | ✅ |

### 9. Transactions
| Élément | Statut |
|---|---|
| `src/routes/transactions.routes.js` | ✅ |
| `src/controllers/transactions.controller.js` | ✅ |
| Branché dans `routes/index.js` | ✅ |

### 10. Incidents
| Élément | Statut |
|---|---|
| `src/routes/incidents.routes.js` | ✅ |
| `src/controllers/incidents.controller.js` | ✅ |
| `src/validators/incident.validator.js` | ✅ |
| Branché dans `routes/index.js` | ✅ |

---

## Progression globale

```
Infrastructure  ████████████████████  100%
Auth            ████████████████████  100%
Quartiers       ████████████████████  100%
Utilisateurs    ████████████████████  100%
Annonces        ████████████████████  100%
Événements      ████████████████████  100%
Votes           ████████████████████  100%
Conversations   ████████████████████  100%
Messages        ████████████████████  100%
Contrats        ████████████████████  100%
Transactions    ████████████████████  100%
Incidents       ████████████████████  100%
```
