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

/**
 * @swagger
 * /api/stats/heatmap:
 *   get:
 *     summary: Carte de chaleur de l'activité par quartier (admin, modérateur)
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: Pour chaque quartier, nombre d'habitants, annonces, événements, incidents (30 derniers jours) et score global
 */
router.get('/heatmap', auth, role('admin', 'moderateur'), ctrl.getHeatmap);

module.exports = router;
