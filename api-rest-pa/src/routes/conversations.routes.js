const express = require('express');
const router  = express.Router();

const ctrl     = require('../controllers/conversations.controller');
const auth     = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const upload   = require('../middlewares/upload.middleware');
const { createSchema, messageSchema } = require('../validators/conversation.validator');

/**
 * @swagger
 * /api/conversations:
 *   get:
 *     summary: Mes conversations
 *     tags: [Conversations]
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
 *                       items: { $ref: '#/components/schemas/Conversation' }
 *   post:
 *     summary: Créer ou retrouver une conversation
 *     description: Si une conversation entre ces participants existe déjà, elle est retournée.
 *     tags: [Conversations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [participants]
 *             properties:
 *               participants:
 *                 type: array
 *                 items: { type: integer }
 *                 description: IDs PostgreSQL des participants (l'utilisateur connecté est ajouté automatiquement)
 *                 example: [2, 3]
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Conversation' }
 */
router.get('/', auth, ctrl.getMes);
router.post('/', auth, validate(createSchema), ctrl.create);

/**
 * @swagger
 * /api/conversations/{id}:
 *   get:
 *     summary: Détail d'une conversation
 *     tags: [Conversations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID MongoDB
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Conversation' }
 *       403: { description: Vous n'êtes pas participant }
 */
router.get('/:id', auth, ctrl.getById);

/**
 * @swagger
 * /api/conversations/{id}/messages:
 *   get:
 *     summary: Messages d'une conversation
 *     tags: [Conversations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
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
 *                       items: { $ref: '#/components/schemas/Message' }
 *   post:
 *     summary: Envoyer un message dans une conversation
 *     tags: [Conversations]
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
 *             required: [contenu]
 *             properties:
 *               contenu: { type: string, minLength: 1 }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Message' }
 */
router.get('/:id/messages',  auth, ctrl.getMessages);
router.post('/:id/messages', auth, validate(messageSchema), ctrl.envoyerMessage);

/**
 * @swagger
 * /api/conversations/{id}/messages/media:
 *   post:
 *     summary: Envoyer une image dans une conversation
 *     description: Upload une image (jpeg, png, webp, gif - 5 Mo max) vers Cloudinary et crée un message de type "image".
 *     tags: [Conversations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Message' }
 *       400: { description: Aucun fichier fourni ou type invalide }
 *       403: { description: Vous n'êtes pas participant }
 */
router.post('/:id/messages/media', auth, upload.single('image'), ctrl.envoyerMessageMedia);

module.exports = router;
