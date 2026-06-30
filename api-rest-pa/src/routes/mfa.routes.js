const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/mfa.controller');
const auth    = require('../middlewares/auth.middleware');

/**
 * @swagger
 * /api/auth/mfa/setup:
 *   get:
 *     summary: Générer un secret TOTP et un QR code pour configurer le MFA
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Secret TOTP + QR code base64
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 secret:      { type: string }
 *                 otpauth_url: { type: string }
 *                 qr_code:     { type: string, description: "Data URL PNG base64" }
 */
router.get('/setup', auth, ctrl.setup);

/**
 * @swagger
 * /api/auth/mfa/activate:
 *   post:
 *     summary: Activer le MFA en vérifiant le premier code TOTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, minLength: 6, maxLength: 6 }
 *     responses:
 *       200: { description: MFA activé }
 *       400: { description: Code invalide }
 */
router.post('/activate', auth, ctrl.activate);

/**
 * @swagger
 * /api/auth/mfa/disable:
 *   post:
 *     summary: Désactiver le MFA (nécessite un code TOTP valide)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, minLength: 6, maxLength: 6 }
 *     responses:
 *       200: { description: MFA désactivé }
 *       400: { description: Code invalide }
 */
router.post('/disable', auth, ctrl.disable);

/**
 * @swagger
 * /api/auth/mfa/verify:
 *   post:
 *     summary: Vérifier le code TOTP après login (échange mfa_token contre vrai JWT)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mfa_token, code]
 *             properties:
 *               mfa_token: { type: string, description: "Token temporaire retourné par /login si MFA actif" }
 *               code:      { type: string, minLength: 6, maxLength: 6 }
 *     responses:
 *       200:
 *         description: JWT complet retourné
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400: { description: Code invalide }
 *       401: { description: mfa_token invalide ou expiré }
 */
router.post('/verify', ctrl.verify);

/**
 * @swagger
 * /api/auth/mfa/verify-action:
 *   post:
 *     summary: Vérifier un code TOTP pour une action sensible (signature contrat, etc.)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, minLength: 6, maxLength: 6 }
 *     responses:
 *       200:
 *         description: Code vérifié
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verified: { type: boolean, example: true }
 *       400: { description: Code invalide }
 */
router.post('/verify-action', auth, ctrl.verifyAction);

module.exports = router;
