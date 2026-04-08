const express = require('express');
const router  = express.Router();

const ctrl = require('../controllers/notifications.controller');
const auth = require('../middlewares/auth.middleware');

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Mes notifications (paginées)
 *     tags: [Notifications]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: est_lue
 *         schema: { type: boolean }
 *         description: Filtrer par statut de lecture
 *     responses:
 *       200:
 *         description: Liste paginée des notifications
 */
router.get('/', auth, ctrl.getMes);

/**
 * @swagger
 * /api/notifications/lire-tout:
 *   put:
 *     summary: Marquer toutes mes notifications comme lues
 *     tags: [Notifications]
 *     responses:
 *       200: { description: OK }
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
 *       200: { description: Notification mise à jour }
 *       404: { description: Non trouvée }
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
 *       404: { description: Non trouvée }
 */
router.delete('/:id', auth, ctrl.remove);

module.exports = router;
