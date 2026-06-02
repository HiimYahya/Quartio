const express = require('express');
const router  = express.Router();

const ctrl     = require('../controllers/utilisateurs.controller');
const auth     = require('../middlewares/auth.middleware');
const role     = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { updateSchema, addQuartierSchema } = require('../validators/utilisateur.validator');

/**
 * @swagger
 * /api/utilisateurs:
 *   get:
 *     summary: Liste tous les utilisateurs
 *     description: Accès réservé aux administrateurs. Supporte le filtrage par rôle.
 *     tags: [Utilisateurs]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [user, admin, moderateur] }
 *         description: Filtrer par rôle
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Liste paginée
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/UtilisateurPublic' }
 *       403: { description: Accès réservé aux admins }
 */
router.get('/', auth, role('admin'), ctrl.getAll);

/**
 * @swagger
 * /api/utilisateurs/{id}:
 *   get:
 *     summary: Profil d'un utilisateur
 *     tags: [Utilisateurs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UtilisateurPublic' }
 *       404: { description: Utilisateur non trouvé }
 *   put:
 *     summary: Modifier son profil
 *     description: Un utilisateur peut modifier son propre profil. Un admin peut modifier n'importe quel profil.
 *     tags: [Utilisateurs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UtilisateurUpdate' }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UtilisateurPublic' }
 *       403: { description: Accès refusé }
 *   delete:
 *     summary: Supprimer un utilisateur
 *     description: Réservé aux admins. Supprime aussi le nœud Neo4j.
 *     tags: [Utilisateurs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Supprimé }
 *       403: { description: Accès réservé aux admins }
 */
router.get('/:id',  auth, ctrl.getById);
router.put('/:id',  auth, validate(updateSchema), ctrl.update);
router.delete('/:id', auth, role('admin'), ctrl.remove);

/**
 * @swagger
 * /api/utilisateurs/{id}/quartiers:
 *   get:
 *     summary: Quartier(s) de l'utilisateur
 *     description: Retourne le ou les quartiers auxquels l'utilisateur est rattaché via Neo4j.
 *     tags: [Utilisateurs]
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
 *               items: { $ref: '#/components/schemas/Quartier' }
 */
router.get('/:id/quartiers', auth, ctrl.getQuartiers);

/**
 * @swagger
 * /api/utilisateurs/{id}/quartier/detect:
 *   post:
 *     summary: Détecter et assigner un quartier par adresse
 *     description: |
 *       Géocode l'adresse via Nominatim (OpenStreetMap), puis utilise l'algorithme de
 *       **ray casting** pour déterminer dans quel quartier défini le point tombe.
 *       Si un quartier est trouvé, la relation HABITE est créée dans Neo4j.
 *     tags: [Utilisateurs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [adresse]
 *             properties:
 *               adresse:
 *                 type: string
 *                 example: "12 rue de Rivoli, Paris"
 *     responses:
 *       200:
 *         description: Quartier trouvé et assigné
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 quartier: { $ref: '#/components/schemas/Quartier' }
 *                 coordinates:
 *                   type: object
 *                   properties:
 *                     lat: { type: number }
 *                     lng: { type: number }
 *       404: { description: Aucun quartier ne correspond à cette adresse }
 *       422: { description: Adresse introuvable par le géocodeur }
 */
router.post('/:id/quartier/detect', auth, ctrl.detectQuartier);

/**
 * @swagger
 * /api/utilisateurs/{id}/quartier:
 *   post:
 *     summary: Assigner manuellement un quartier
 *     tags: [Utilisateurs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_quartier]
 *             properties:
 *               id_quartier: { type: integer }
 *     responses:
 *       201: { description: Associé au quartier }
 *       404: { description: Quartier non trouvé }
 */
router.post('/:id/quartier', auth, validate(addQuartierSchema), ctrl.addQuartier);

/**
 * @swagger
 * /api/utilisateurs/{id}/quartier/{idQ}:
 *   delete:
 *     summary: Retirer l'utilisateur d'un quartier
 *     tags: [Utilisateurs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: idQ
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Relation supprimée }
 */
router.delete('/:id/quartier/:idQ', auth, ctrl.removeQuartier);

/**
 * @swagger
 * /api/utilisateurs/{id}/transactions:
 *   get:
 *     summary: Historique des transactions de points
 *     tags: [Utilisateurs]
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
 *               items: { $ref: '#/components/schemas/Transaction' }
 */
router.get('/:id/transactions', auth, ctrl.getTransactions);

module.exports = router;
