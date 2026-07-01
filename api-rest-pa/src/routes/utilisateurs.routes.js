const express = require('express');
const router  = express.Router();

const ctrl     = require('../controllers/utilisateurs.controller');
const auth     = require('../middlewares/auth.middleware');
const role     = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  updateSchema, addQuartierSchema,
  changePasswordSchema, changeEmailSchema, changeTelephoneSchema,
} = require('../validators/utilisateur.validator');

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
 * /api/utilisateurs/voisins-fiables:
 *   get:
 *     summary: Voisins de confiance
 *     description: >
 *       Retourne les voisins ayant le plus de contrats finalisés avec l'utilisateur connecté,
 *       basé sur la relation Neo4j `[:A_AIDE]` (créée à la finalisation d'un contrat), triés
 *       par score décroissant.
 *     tags: [Utilisateurs]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Liste des voisins de confiance
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id_utilisateur: { type: integer }
 *                   nom:            { type: string }
 *                   prenom:         { type: string }
 *                   points_solde:   { type: integer }
 *                   score:          { type: integer, description: Nombre de contrats finalisés ensemble }
 *       401: { description: Non authentifié }
 */
router.get('/voisins-fiables', auth, ctrl.voisinsFiables);

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
 * /api/utilisateurs/{id}/suspension:
 *   put:
 *     summary: Suspendre / réactiver un compte (admin)
 *     description: "`jours` > 0 suspend le compte pour N jours (sessions révoquées) ; `jours` = 0 ou absent réactive."
 *     tags: [Utilisateurs]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { jours: { type: integer, example: 7 } }
 *     responses:
 *       200: { description: Statut de suspension mis à jour }
 *       404: { description: Utilisateur non trouvé }
 */
router.put('/:id/suspension', auth, role('admin'), ctrl.suspendre);

/**
 * @swagger
 * /api/utilisateurs/{id}/points:
 *   post:
 *     summary: Créditer / débiter des points (admin)
 *     tags: [Utilisateurs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [montant]
 *             properties:
 *               montant: { type: integer, description: "Positif = crédit, négatif = débit", example: 50 }
 *               motif:   { type: string, example: "Récompense bénévolat" }
 *     responses:
 *       200: { description: Nouveau solde }
 *       400: { description: Montant invalide ou solde insuffisant }
 */
router.post('/:id/points', auth, role('admin'), ctrl.ajusterPoints);

/**
 * @swagger
 * /api/utilisateurs/{id}/password:
 *   put:
 *     summary: Changer son mot de passe
 *     description: >
 *       Nécessite le mot de passe actuel. Si le MFA est activé, le `mfa_code` est également requis.
 *       Toutes les sessions actives sont déconnectées après le changement.
 *     tags: [Utilisateurs]
 *     security: [{ bearerAuth: [] }]
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
 *             required: [ancien_mot_de_passe, nouveau_mot_de_passe]
 *             properties:
 *               ancien_mot_de_passe:  { type: string }
 *               nouveau_mot_de_passe: { type: string, minLength: 8 }
 *               mfa_code:             { type: string, minLength: 6, maxLength: 6 }
 *     responses:
 *       200: { description: Mot de passe modifié }
 *       400: { description: Mot de passe actuel ou code MFA invalide }
 *       403: { description: Accès refusé }
 */
router.put('/:id/password', auth, validate(changePasswordSchema), ctrl.changePassword);

/**
 * @swagger
 * /api/utilisateurs/{id}/email:
 *   put:
 *     summary: Changer son email
 *     description: >
 *       Le nouvel email doit être unique. Si le MFA est activé, le `mfa_code` est requis.
 *       Un code de re-vérification est envoyé au nouvel email (`POST /api/auth/verify-email`).
 *     tags: [Utilisateurs]
 *     security: [{ bearerAuth: [] }]
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
 *             required: [nouvel_email]
 *             properties:
 *               nouvel_email: { type: string, format: email }
 *               mfa_code:     { type: string, minLength: 6, maxLength: 6 }
 *     responses:
 *       200: { description: Email modifié, vérification requise }
 *       400: { description: Email déjà utilisé par soi-même ou code MFA invalide }
 *       403: { description: Accès refusé }
 *       409: { description: Cet email est déjà utilisé }
 */
router.put('/:id/email', auth, validate(changeEmailSchema), ctrl.changeEmail);

/**
 * @swagger
 * /api/utilisateurs/{id}/telephone:
 *   put:
 *     summary: Changer son numéro de téléphone
 *     description: Si le MFA est activé, le `mfa_code` est requis.
 *     tags: [Utilisateurs]
 *     security: [{ bearerAuth: [] }]
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
 *             required: [telephone]
 *             properties:
 *               telephone: { type: string, nullable: true }
 *               mfa_code:  { type: string, minLength: 6, maxLength: 6 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UtilisateurPublic' }
 *       400: { description: Code MFA invalide }
 *       403: { description: Accès refusé }
 */
router.put('/:id/telephone', auth, validate(changeTelephoneSchema), ctrl.changeTelephone);

/**
 * @swagger
 * /api/utilisateurs/{id}/sessions:
 *   get:
 *     summary: Lister ses sessions actives
 *     description: Retourne les refresh tokens actifs (non révoqués, non expirés) du compte.
 *     tags: [Utilisateurs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Liste des sessions actives
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:        { type: integer }
 *                   cree_le:   { type: string, format: date-time }
 *                   expire_le: { type: string, format: date-time }
 *       403: { description: Accès refusé }
 *   delete:
 *     summary: Déconnecter toutes les sessions
 *     description: Révoque tous les refresh tokens actifs du compte ("Déconnecter partout").
 *     tags: [Utilisateurs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Sessions déconnectées }
 *       403: { description: Accès refusé }
 */
router.get('/:id/sessions', auth, ctrl.getSessions);
router.delete('/:id/sessions', auth, ctrl.revokeSessions);

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
