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
 *     summary: Liste tous les événements
 *     tags: [Événements]
 *     security: []
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
router.get('/', ctrl.getAll);
router.post('/', auth, validate(createSchema), ctrl.create);

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

module.exports = router;
