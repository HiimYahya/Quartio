const express = require('express');
const router  = express.Router();

const ctrl = require('../controllers/transactions.controller');
const auth = require('../middlewares/auth.middleware');

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Mes transactions de points
 *     description: Retourne l'historique des mouvements de points de l'utilisateur connecté.
 *     tags: [Transactions]
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
 *                       items: { $ref: '#/components/schemas/Transaction' }
 */
router.get('/', auth, ctrl.getMes);

/**
 * @swagger
 * /api/transactions/{id}:
 *   get:
 *     summary: Détail d'une transaction
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Transaction' }
 *       404: { description: Transaction non trouvée }
 */
router.get('/:id', auth, ctrl.getById);

module.exports = router;
