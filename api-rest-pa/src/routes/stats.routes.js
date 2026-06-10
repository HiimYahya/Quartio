const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/stats.controller');
const auth    = require('../middlewares/auth.middleware');
const role    = require('../middlewares/role.middleware');

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Statistiques globales (admin)
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: KPIs, séries hebdomadaires, classement, top catégories, incidents urgents
 */
router.get('/', auth, role('admin', 'moderateur'), ctrl.getStats);

module.exports = router;
