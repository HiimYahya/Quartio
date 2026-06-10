const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/rgpd.controller');
const auth    = require('../middlewares/auth.middleware');

/**
 * @swagger
 * /api/rgpd/export:
 *   get:
 *     summary: Exporter toutes mes données personnelles (RGPD)
 *     tags: [RGPD]
 *     description: >
 *       Retourne un fichier JSON complet contenant toutes les données personnelles
 *       de l'utilisateur connecté : profil, contrats, transactions, notifications,
 *       votes, annonces, événements, incidents, conversations, messages, relations Neo4j.
 *     responses:
 *       200:
 *         description: Fichier JSON téléchargeable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 export_date:    { type: string, format: date-time }
 *                 profil:         { $ref: '#/components/schemas/UtilisateurPublic' }
 *                 contrats:       { type: array, items: { $ref: '#/components/schemas/Contrat' } }
 *                 transactions:   { type: array, items: { $ref: '#/components/schemas/Transaction' } }
 *                 annonces:       { type: array, items: { $ref: '#/components/schemas/Annonce' } }
 *                 evenements:     { type: array }
 *                 incidents:      { type: array }
 *                 messages:       { type: array }
 *                 relations_neo4j:{ type: array }
 */
router.get('/export', auth, ctrl.export);

/**
 * @swagger
 * /api/rgpd/delete-account:
 *   delete:
 *     summary: Supprimer définitivement mon compte (RGPD)
 *     tags: [RGPD]
 *     description: >
 *       Suppression totale et irréversible du compte.
 *       Si le MFA est activé, fournir un code TOTP dans `code`.
 *       Sinon, fournir le mot de passe dans `mot_de_passe`.
 *       Les messages sont anonymisés (contenu remplacé) pour préserver la cohérence des conversations.
 *       Les contrats sont conservés avec les champs vendeur/acheteur mis à NULL (intégrité comptable).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:          { type: string, description: "Code TOTP si MFA activé" }
 *               mot_de_passe:  { type: string, description: "Mot de passe si MFA non activé" }
 *     responses:
 *       200: { description: Compte supprimé }
 *       400: { description: Code MFA invalide ou mot de passe incorrect }
 */
router.delete('/delete-account', auth, ctrl.deleteAccount);

module.exports = router;
