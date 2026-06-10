const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/query.controller');
const auth    = require('../middlewares/auth.middleware');
const role    = require('../middlewares/role.middleware');

/**
 * @swagger
 * /api/query:
 *   post:
 *     summary: Exécuter une requête en langage maison Quartio-QL
 *     tags: [Console]
 *     description: |
 *       Langage d'interrogation maison pour les collections MongoDB.
 *
 *       **Syntaxe :**
 *       ```
 *       FIND   <collection> [WHERE <conditions>] [ORDER BY <field> ASC|DESC] [LIMIT <n>]
 *       COUNT  <collection> [WHERE <conditions>]
 *       INSERT <collection> { "key": value, ... }
 *       UPDATE <collection> WHERE <conditions> SET { "key": value, ... }
 *       DELETE <collection> WHERE <conditions>
 *       ```
 *
 *       **Collections :** annonces, evenements, incidents, conversations, messages
 *
 *       **Opérateurs :** `=`, `!=`, `>`, `<`, `>=`, `<=`, `CONTAINS`, `IN (v1,v2,...)`
 *
 *       **Exemples :**
 *       ```
 *       FIND annonces WHERE statut = "active" LIMIT 10
 *       FIND evenements WHERE statut = "planifie" ORDER BY date_debut ASC LIMIT 5
 *       COUNT incidents WHERE priorite = "critique"
 *       FIND annonces WHERE cout_points > 50 AND statut = "active"
 *       FIND incidents WHERE titre CONTAINS "bruit"
 *       FIND annonces WHERE statut IN ("active", "inactive") LIMIT 20
 *       ```
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *                 example: 'FIND annonces WHERE statut = "active" LIMIT 10'
 *     responses:
 *       200:
 *         description: Résultats de la requête
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type:        { type: string, enum: [find, count, insert, update, delete] }
 *                 collection:  { type: string }
 *                 result:      { description: "Tableau pour FIND, nombre pour COUNT, objet pour INSERT/UPDATE/DELETE" }
 *                 affected:    { type: integer, nullable: true }
 *                 duration_ms: { type: integer }
 *                 ast:         { type: object, description: "AST produit par le transpileur" }
 *       400:
 *         description: Erreur de syntaxe ou collection invalide
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 *                 type:  { type: string, enum: [parse_error] }
 */
router.post('/', auth, role('admin', 'moderateur'), ctrl.execute);

module.exports = router;
