const express = require('express');
const router  = express.Router();

const ctrl = require('../controllers/messages.controller');
const auth = require('../middlewares/auth.middleware');

/**
 * @swagger
 * /api/messages/{id}:
 *   delete:
 *     summary: Supprimer un message
 *     description: Réservé à l'auteur du message ou à un admin.
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID MongoDB du message
 *     responses:
 *       204: { description: Supprimé }
 *       403: { description: Accès refusé }
 *       404: { description: Message non trouvé }
 */
router.delete('/:id', auth, ctrl.remove);

/**
 * @swagger
 * /api/messages/{id}/signaler:
 *   post:
 *     summary: Signaler un message inapproprié
 *     description: Marque le message comme signalé. Les modérateurs et admins pourront le consulter.
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Message signalé }
 *       404: { description: Message non trouvé }
 */
router.post('/:id/signaler', auth, ctrl.signaler);

module.exports = router;
