const express = require('express');
const router  = express.Router();

const ctrl = require('../controllers/notifications.controller');
const auth = require('../middlewares/auth.middleware');

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Mes notifications
 *     tags: [Notifications]
 *     parameters:
 *       - in: query
 *         name: non_lues
 *         schema: { type: boolean }
 *         description: Si true, retourne uniquement les non lues
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
 *                       items: { $ref: '#/components/schemas/Notification' }
 */
router.get('/', auth, ctrl.getMes);

/**
 * @swagger
 * /api/notifications/lire-tout:
 *   put:
 *     summary: Marquer toutes les notifications comme lues
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 updated: { type: integer, description: Nombre de notifications mises à jour }
 */
router.put('/lire-tout', auth, ctrl.marquerToutesLues);

/**
 * @swagger
 * /api/notifications/{id}/lire:
 *   put:
 *     summary: Marquer une notification comme lue
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Notification' }
 *       404: { description: Notification non trouvée }
 */
router.put('/:id/lire', auth, ctrl.marquerLue);

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Supprimer une notification
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Supprimée }
 */
router.delete('/:id', auth, ctrl.remove);

module.exports = router;
