const express = require('express');
const router = express.Router();

const ctrl     = require('../controllers/quartiers.controller');
const auth     = require('../middlewares/auth.middleware');
const role     = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { createSchema, updateSchema } = require('../validators/quartier.validator');

/**
 * @swagger
 * /api/quartiers:
 *   get:
 *     summary: Liste tous les quartiers
 *     description: Authentification requise.
 *     tags: [Quartiers]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Quartier' }
 *   post:
 *     summary: Créer un quartier (admin)
 *     description: |
 *       Crée dans PostgreSQL et Neo4j.
 *       Si une géométrie est fournie, vérifie l'absence de chevauchement via Turf.js.
 *     tags: [Quartiers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/QuartierCreate' }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Quartier' }
 *       409: { description: Chevauchement avec un quartier existant }
 */
router.get('/', auth, ctrl.getAll);
router.post('/', auth, role('admin'), validate(createSchema), ctrl.create);

/**
 * @swagger
 * /api/quartiers/{id}:
 *   get:
 *     summary: Détail d'un quartier
 *     description: Authentification requise.
 *     tags: [Quartiers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Quartier' }
 *       404: { description: Quartier non trouvé }
 *   put:
 *     summary: Modifier un quartier (admin)
 *     description: Vérifie l'absence de chevauchement si la géométrie change.
 *     tags: [Quartiers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/QuartierCreate' }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Quartier' }
 *       409: { description: Chevauchement détecté }
 *   delete:
 *     summary: Supprimer un quartier (admin)
 *     description: Supprime dans PostgreSQL et Neo4j (DETACH DELETE).
 *     tags: [Quartiers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Supprimé }
 */
router.get('/:id', auth, ctrl.getById);
router.put('/:id',  auth, role('admin'), validate(updateSchema), ctrl.update);
router.delete('/:id', auth, role('admin'), ctrl.remove);

/**
 * @swagger
 * /api/quartiers/{id}/habitants:
 *   get:
 *     summary: Habitants du quartier (Neo4j [:HABITE])
 *     description: Un habitant ne peut consulter que son (ses) quartier(s) ; un admin/modérateur accède à tout quartier.
 *     tags: [Quartiers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/UtilisateurPublic' }
 *       403: { description: Ce quartier n'est pas le vôtre }
 */
router.get('/:id/habitants', auth, ctrl.getHabitants);

/**
 * @swagger
 * /api/quartiers/{id}/annonces:
 *   get:
 *     summary: Annonces du quartier (Neo4j -> MongoDB)
 *     description: Un habitant ne peut consulter que son (ses) quartier(s) ; un admin/modérateur accède à tout quartier.
 *     tags: [Quartiers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Annonce' }
 *       403: { description: Ce quartier n'est pas le vôtre }
 */
router.get('/:id/annonces', auth, ctrl.getAnnonces);

/**
 * @swagger
 * /api/quartiers/{id}/evenements:
 *   get:
 *     summary: Événements du quartier (Neo4j -> MongoDB)
 *     description: Un habitant ne peut consulter que son (ses) quartier(s) ; un admin/modérateur accède à tout quartier.
 *     tags: [Quartiers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Evenement' }
 *       403: { description: Ce quartier n'est pas le vôtre }
 */
router.get('/:id/evenements', auth, ctrl.getEvenements);

module.exports = router;
