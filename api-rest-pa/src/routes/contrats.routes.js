const express = require('express');
const router  = express.Router();

const ctrl     = require('../controllers/contrats.controller');
const auth     = require('../middlewares/auth.middleware');
const role     = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { createSchema, statutSchema, signerSchema } = require('../validators/contrat.validator');

/**
 * @swagger
 * /api/contrats:
 *   get:
 *     summary: Mes contrats (vendeur ou acheteur)
 *     description: Retourne tous les contrats où l'utilisateur connecté est vendeur ou acheteur, avec les noms des participants.
 *     tags: [Contrats]
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
 *                       items: { $ref: '#/components/schemas/Contrat' }
 *   post:
 *     summary: Créer un contrat manuellement
 *     description: Création directe sans passer par une annonce. Utilisé par le backoffice ou des cas spéciaux.
 *     tags: [Contrats]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               points_echanges:  { type: integer, minimum: 0, default: 0 }
 *               id_annonce_mongo: { type: string, nullable: true }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Contrat' }
 */
router.get('/',  auth, ctrl.getMes);
router.post('/', auth, validate(createSchema), ctrl.create);

/**
 * @swagger
 * /api/contrats/{id}:
 *   get:
 *     summary: Détail d'un contrat
 *     description: Inclut les noms et prénoms des deux parties ainsi que l'état de chaque signature.
 *     tags: [Contrats]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Contrat' }
 *       403: { description: Vous n'êtes pas participant à ce contrat }
 *       404: { description: Contrat non trouvé }
 */
router.get('/:id', auth, ctrl.getById);

/**
 * @swagger
 * /api/contrats/{id}/signer:
 *   put:
 *     summary: Signer le contrat
 *     description: |
 *       Enregistre la signature de l'utilisateur connecté (vendeur ou acheteur).
 *
 *       **Finalisation automatique** quand les deux parties ont signé :
 *       - Les points sont débités du compte de l'acheteur
 *       - Les points sont crédités au vendeur
 *       - Deux transactions sont créées dans l'historique
 *       - Le contrat passe au statut `termine`
 *       - L'annonce liée passe au statut `archivee`
 *       - Les deux parties reçoivent une notification
 *
 *       Si le MFA est activé sur le compte, le code TOTP (`mfa_code`) est obligatoire.
 *       Si un PDF signé (`pdf_base64`) est fourni, il est archivé dans MongoDB avec son
 *       hash SHA-256 (preuve d'intégrité), accessible ensuite via `GET /api/contrats/{id}/document`.
 *     tags: [Contrats]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               signature_dataurl: { type: string, description: "Image PNG base64 de la signature manuscrite" }
 *               pdf_base64:        { type: string, description: "PDF signé encodé en base64, archivé dans MongoDB" }
 *               mfa_code:          { type: string, minLength: 6, maxLength: 6, description: "Code TOTP, requis si le MFA est activé" }
 *     responses:
 *       200:
 *         description: Contrat mis à jour (signé ou finalisé)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Contrat' }
 *       400:
 *         description: Code MFA requis ou invalide
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Déjà signé, contrat annulé, ou points insuffisants
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.put('/:id/signer', auth, validate(signerSchema), ctrl.signer);

/**
 * @swagger
 * /api/contrats/{id}/document:
 *   get:
 *     summary: Document signé archivé (MongoDB)
 *     description: |
 *       Retourne le PDF signé archivé, son hash SHA-256 (preuve d'intégrité) et
 *       l'historique des signatures. Accessible aux deux parties du contrat et aux admins.
 *     tags: [Contrats]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Document archivé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_contrat_pg: { type: integer }
 *                 pdf_url:       { type: string, nullable: true }
 *                 pdf_base64:    { type: string, nullable: true }
 *                 hash_sha256:   { type: string, nullable: true }
 *                 signatures:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_utilisateur_pg: { type: integer }
 *                       prenom:    { type: string }
 *                       nom:       { type: string }
 *                       signed_at: { type: string, format: date-time }
 *                 updated_at: { type: string, format: date-time }
 *       403: { description: Accès refusé }
 *       404: { description: Aucun document archivé pour ce contrat }
 */
router.get('/:id/document', auth, ctrl.getDocument);

/**
 * @swagger
 * /api/contrats/{id}/statut:
 *   put:
 *     summary: Changer le statut d'un contrat (admin)
 *     tags: [Contrats]
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
 *             required: [statut]
 *             properties:
 *               statut: { type: string, enum: [en_attente, signe, annule, termine] }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Contrat' }
 */
router.put('/:id/statut', auth, role('admin'), validate(statutSchema), ctrl.updateStatut);

/**
 * @swagger
 * /api/contrats/{id}:
 *   delete:
 *     summary: Supprimer un contrat (admin)
 *     tags: [Contrats]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Supprimé }
 *       404: { description: Contrat non trouvé }
 */
router.delete('/:id', auth, role('admin'), ctrl.remove);

module.exports = router;
