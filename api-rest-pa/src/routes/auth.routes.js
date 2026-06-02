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
 *       201: { description: Compte créé }
 *       409: { description: Email déjà utilisé }
 */
router.post('/register', validate(registerSchema), ctrl.register);

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

module.exports = router;
