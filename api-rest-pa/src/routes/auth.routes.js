const express = require('express');
const router  = express.Router();

const ctrl     = require('../controllers/auth.controller');
const auth     = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { registerSchema, loginSchema } = require('../validators/auth.validator');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Créer un compte
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nom, prenom, email, mot_de_passe]
 *             properties:
 *               nom:          { type: string }
 *               prenom:       { type: string }
 *               email:        { type: string, format: email }
 *               mot_de_passe: { type: string, minLength: 8 }
 *     responses:
 *       201: { description: Compte créé - vérification email requise }
 *       409: { description: Email déjà utilisé }
 */
router.post('/register', validate(registerSchema), ctrl.register);

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Vérifier l'adresse email avec le code OTP
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string }
 *               code:  { type: string, minLength: 6, maxLength: 6 }
 *     responses:
 *       200: { description: Email vérifié }
 *       400: { description: Code invalide ou expiré }
 */
router.post('/verify-email', ctrl.verifyEmail);

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Renvoyer le code de vérification email
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200: { description: Code renvoyé }
 */
router.post('/resend-verification', ctrl.resendVerification);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Demander un lien de réinitialisation du mot de passe
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200: { description: Lien envoyé (réponse générique pour sécurité) }
 */
router.post('/forgot-password', ctrl.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Réinitialiser le mot de passe avec le token reçu par email
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, mot_de_passe]
 *             properties:
 *               token:        { type: string }
 *               mot_de_passe: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Mot de passe mis à jour }
 *       400: { description: Token invalide ou expiré }
 */
router.post('/reset-password', ctrl.resetPassword);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Se connecter
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, mot_de_passe]
 *             properties:
 *               email:        { type: string }
 *               mot_de_passe: { type: string }
 *     responses:
 *       200: { description: Token JWT retourné }
 *       401: { description: Identifiants incorrects }
 *       403: { description: Email non vérifié }
 */
router.post('/login', validate(loginSchema), ctrl.login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Renouveler l'access token
 *     tags: [Auth]
 *     security: []
 */
router.post('/refresh', ctrl.refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Se déconnecter (révoque le refresh token)
 *     tags: [Auth]
 */
router.post('/logout', ctrl.logout);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Profil de l'utilisateur connecté
 *     tags: [Auth]
 */
router.get('/me', auth, ctrl.me);

/**
 * @swagger
 * /api/auth/sso-token:
 *   get:
 *     summary: Générer un token SSO court (5 min) pour l'application Java Desktop
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Token SSO
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sso_token: { type: string }
 *                 expires_in: { type: integer, example: 300 }
 */
router.get('/sso-token', auth, ctrl.ssoToken);

module.exports = router;
