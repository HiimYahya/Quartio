const express = require('express');
const router  = express.Router();

const ctrl     = require('../controllers/votes.controller');
const auth     = require('../middlewares/auth.middleware');
const role     = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { createSchema, updateSchema, voterSchema } = require('../validators/vote.validator');

/**
 * @swagger
 * /api/votes:
 *   get:
 *     summary: Liste les votes de son quartier
 *     description: Authentification requise. Un habitant ne voit que les votes de son (ses) quartier(s) ; un admin/modérateur voit tous les votes.
 *     tags: [Votes]
 *     parameters:
 *       - in: query
 *         name: statut
 *         schema: { type: string, enum: [ouvert, ferme, archive] }
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
 *                       items: { $ref: '#/components/schemas/Vote' }
 *   post:
 *     summary: Créer un vote
 *     description: |
 *       Rattaché automatiquement au quartier de l'auteur (un habitant doit avoir un quartier, sinon 400).
 *       `type_vote` : `choix_multiple` | `oui_non` | `classement`. Pour `oui_non`, les options Oui/Non
 *       sont générées côté serveur (sinon au moins 2 options requises). `nb_choix_max` configure le nombre de choix.
 *     tags: [Votes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/VoteCreate' }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Vote' }
 */
router.get('/', auth, ctrl.getAll);
router.post('/', auth, validate(createSchema), ctrl.create);

/**
 * @swagger
 * /api/votes/{id}:
 *   get:
 *     summary: Détail d'un vote
 *     tags: [Votes]
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
 *             schema: { $ref: '#/components/schemas/Vote' }
 *       404: { description: Vote non trouvé }
 *   put:
 *     summary: Modifier le statut d'un vote
 *     tags: [Votes]
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
 *               statut: { type: string, enum: [ouvert, ferme, archive] }
 *               titre:  { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Vote' }
 *   delete:
 *     summary: Supprimer un vote (admin)
 *     tags: [Votes]
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
 * /api/votes/{id}/voter:
 *   post:
 *     summary: Voter pour une option
 *     description: Un utilisateur ne peut voter qu'une seule fois par vote. Si le vote est anonyme, l'identité n'est pas enregistrée.
 *     tags: [Votes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_option]
 *             properties:
 *               id_option:
 *                 type: string
 *                 description: ID MongoDB de l'option
 *     responses:
 *       201: { description: Vote enregistré }
 *       409: { description: Déjà voté ou vote fermé }
 */
router.post('/:id/voter', auth, validate(voterSchema), ctrl.voter);

/**
 * @swagger
 * /api/votes/{id}/resultats:
 *   get:
 *     summary: Résultats du vote
 *     description: Retourne le nombre de votes par option.
 *     tags: [Votes]
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
 *               items:
 *                 type: object
 *                 properties:
 *                   libelle: { type: string }
 *                   count:   { type: integer }
 */
router.get('/:id/resultats', auth, ctrl.getResultats);

module.exports = router;
