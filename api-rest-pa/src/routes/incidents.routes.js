const express = require('express');
const router  = express.Router();

const ctrl     = require('../controllers/incidents.controller');
const auth     = require('../middlewares/auth.middleware');
const role     = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { createSchema, updateSchema } = require('../validators/incident.validator');

/**
 * @swagger
 * /api/incidents:
 *   get:
 *     summary: Liste les incidents
 *     description: Authentification requise. La vue modération `?signalements=true` (messages signalés) est réservée aux admins et modérateurs.
 *     tags: [Incidents]
 *     parameters:
 *       - in: query
 *         name: statut
 *         schema: { type: string, enum: [ouvert, en_cours, resolu, ferme] }
 *       - in: query
 *         name: priorite
 *         schema: { type: string, enum: [basse, normale, haute, critique] }
 *       - in: query
 *         name: signalements
 *         schema: { type: boolean }
 *         description: Si true, retourne uniquement les messages signalés (avec contenu + auteur)
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
 *                       items: { $ref: '#/components/schemas/Incident' }
 *       403: { description: Accès réservé aux admins et modérateurs }
 *   post:
 *     summary: Signaler un incident
 *     tags: [Incidents]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [titre]
 *             properties:
 *               titre:       { type: string, minLength: 2 }
 *               description: { type: string }
 *               type:        { type: string, example: voirie }
 *               priorite:    { type: string, enum: [basse, normale, haute, critique], default: normale }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Incident' }
 */
// Lecture ouverte aux habitants (incidents du quartier) ; la vue modération
// (?signalements=true) est restreinte aux admin/modérateurs dans le contrôleur.
router.get('/',  auth, ctrl.getAll);
router.post('/', auth, validate(createSchema), ctrl.create);

/**
 * @swagger
 * /api/incidents/{id}:
 *   get:
 *     summary: Détail d'un incident
 *     tags: [Incidents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Incident' }
 *       404: { description: Incident non trouvé }
 *   put:
 *     summary: Mettre à jour un incident (admin, modérateur)
 *     description: Permet de changer le statut, la priorité ou la date de résolution.
 *     tags: [Incidents]
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
 *               statut:          { type: string, enum: [ouvert, en_cours, resolu, ferme] }
 *               priorite:        { type: string, enum: [basse, normale, haute, critique] }
 *               date_resolution: { type: string, format: date-time }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Incident' }
 *   delete:
 *     summary: Supprimer un incident (admin)
 *     tags: [Incidents]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Supprimé }
 */
router.get('/:id',  auth, ctrl.getById);
router.put('/:id',  auth, role('admin', 'moderateur'), validate(updateSchema), ctrl.update);
router.delete('/:id', auth, role('admin'), ctrl.remove);

module.exports = router;
