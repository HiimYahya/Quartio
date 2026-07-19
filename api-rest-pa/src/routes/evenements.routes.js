const express = require('express');
const router  = express.Router();

const ctrl     = require('../controllers/evenements.controller');
const auth     = require('../middlewares/auth.middleware');
const role     = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { createSchema, updateSchema } = require('../validators/evenement.validator');

/**
 * @swagger
 * /api/evenements:
 *   get:
 *     summary: Liste les événements de son quartier
 *     description: Authentification requise. Un habitant ne voit que les événements de son (ses) quartier(s) ; un admin/modérateur voit tous les événements.
 *     tags: [Événements]
 *     parameters:
 *       - in: query
 *         name: statut
 *         schema: { type: string, enum: [planifie, en_cours, termine, annule] }
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
 *                       items: { $ref: '#/components/schemas/Evenement' }
 *   post:
 *     summary: Créer un événement
 *     description: Rattaché automatiquement au quartier de l'organisateur si `id_quartier` est absent (un habitant doit avoir un quartier, sinon 400 ; l'admin peut cibler un autre quartier).
 *     tags: [Événements]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/EvenementCreate' }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Evenement' }
 */
router.get('/', auth, ctrl.getAll);
router.post('/', auth, validate(createSchema), ctrl.create);

router.get('/suggestions', auth, ctrl.suggestions);

/**
 * @swagger
 * /api/evenements/{id}:
 *   get:
 *     summary: Détail d'un événement
 *     tags: [Événements]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Evenement' }
 *       404: { description: Événement non trouvé }
 *   put:
 *     summary: Modifier un événement
 *     tags: [Événements]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               titre:        { type: string }
 *               statut:       { type: string, enum: [planifie, en_cours, termine, annule] }
 *               capacite_max: { type: integer }
 *               lieu:         { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Evenement' }
 *   delete:
 *     summary: Supprimer un événement (admin)
 *     tags: [Événements]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Supprimé }
 */
router.get('/:id', ctrl.getById);
router.put('/:id', auth, validate(updateSchema), ctrl.update);
router.delete('/:id', auth, role('admin'), ctrl.remove);

/**
 * @swagger
 * /api/evenements/{id}/participer:
 *   post:
 *     summary: S'inscrire à un événement
 *     description: Crée la relation Neo4j [:PARTICIPE]. Vérifie la capacité max si définie.
 *     tags: [Événements]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201: { description: Inscription confirmée }
 *       409: { description: Complet ou déjà inscrit }
 *   delete:
 *     summary: Se désinscrire d'un événement
 *     tags: [Événements]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Désinscription effectuée }
 */
router.post('/:id/participer',   auth, ctrl.participer);
router.delete('/:id/participer', auth, ctrl.seDesinscrire);

/**
 * @swagger
 * /api/evenements/{id}/participants:
 *   get:
 *     summary: Participants à l'événement
 *     tags: [Événements]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/UtilisateurPublic' }
 */
router.get('/:id/participants', auth, ctrl.getParticipants);

/**
 * @swagger
 * /api/evenements/{id}/swipe:
 *   post:
 *     summary: Enregistrer un swipe (intérêt) dans Neo4j
 *     tags: [Événements]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [direction]
 *             properties:
 *               direction: { type: string, enum: [right, left] }
 *     responses:
 *       201: { description: Relation Neo4j créée }
 */
router.post('/:id/swipe', auth, ctrl.swipe);

/**
 * @swagger
 * /api/evenements/suggestions:
 *   get:
 *     summary: Événements suggérés basés sur les intérêts communs (Neo4j)
 *     tags: [Événements]
 *     responses:
 *       200:
 *         description: Liste d'événements recommandés
 */

module.exports = router;
