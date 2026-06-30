const express = require('express');
const router  = express.Router();

const ctrl     = require('../controllers/annonces.controller');
const auth     = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { createSchema, updateSchema } = require('../validators/annonce.validator');

/**
 * @swagger
 * /api/annonces:
 *   get:
 *     summary: Liste toutes les annonces
 *     tags: [Annonces]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: statut
 *         schema: { type: string, enum: [active, inactive, archivee] }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [offre, demande] }
 *       - in: query
 *         name: categorie
 *         schema: { type: string }
 *         description: Recherche partielle insensible à la casse
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
 *                       items: { $ref: '#/components/schemas/Annonce' }
 *   post:
 *     summary: Publier une annonce
 *     tags: [Annonces]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AnnonceCreate' }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Annonce' }
 *       400: { description: Données invalides }
 */
router.get('/', auth, ctrl.getAll);
router.post('/', auth, validate(createSchema), ctrl.create);

/**
 * @swagger
 * /api/annonces/{id}:
 *   get:
 *     summary: Détail d'une annonce
 *     tags: [Annonces]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID MongoDB (ObjectId)
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Annonce' }
 *       404: { description: Annonce non trouvée }
 *   put:
 *     summary: Modifier une annonce
 *     description: Réservé à l'auteur ou à un admin.
 *     tags: [Annonces]
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
 *               titre:       { type: string }
 *               description: { type: string }
 *               statut:      { type: string, enum: [active, inactive, archivee] }
 *               cout_points: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Annonce' }
 *   delete:
 *     summary: Supprimer une annonce
 *     description: Réservé à l'auteur ou à un admin.
 *     tags: [Annonces]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Supprimée }
 */
router.get('/:id', ctrl.getById);
router.put('/:id', auth, validate(updateSchema), ctrl.update);
router.delete('/:id', auth, ctrl.remove);

/**
 * @swagger
 * /api/annonces/{id}/contrat:
 *   get:
 *     summary: Contrat lié à cette annonce
 *     tags: [Annonces]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Contrat' }
 *       404: { description: Aucun contrat lié }
 *   post:
 *     summary: Accepter une annonce et créer un contrat
 *     description: |
 *       L'utilisateur connecté devient l'**acheteur**, l'auteur de l'annonce le **vendeur**.
 *       Vérifie que l'acheteur a assez de points (si payant) et qu'un contrat n'existe
 *       pas déjà pour cette annonce + cet acheteur.
 *       Les points sont débités uniquement à la **finalisation** (quand les deux ont signé).
 *     tags: [Annonces]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Contrat créé, en attente de signature des deux parties
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Contrat' }
 *       409:
 *         description: Annonce inactive, auto-acceptation, points insuffisants ou contrat déjà existant
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:      { type: string }
 *                 id_contrat: { type: integer, description: 'Présent si contrat déjà existant' }
 */
router.get('/:id/contrat',  auth, ctrl.getContrat);
router.post('/:id/contrat', auth, ctrl.creerContrat);

module.exports = router;
