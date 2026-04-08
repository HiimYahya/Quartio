const express = require('express');
const router = express.Router();

const ctrl     = require('../controllers/quartiers.controller');
const auth     = require('../middlewares/auth.middleware');
const role     = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { createSchema, updateSchema } = require('../validators/quartier.validator');

// Lecture publique
router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getById);

// Écriture — admin uniquement
router.post('/',    auth, role('admin'), validate(createSchema), ctrl.create);
router.put('/:id',  auth, role('admin'), validate(updateSchema), ctrl.update);
router.delete('/:id', auth, role('admin'), ctrl.remove);

// Sous-ressources
router.get('/:id/habitants',  auth, ctrl.getHabitants);
router.get('/:id/annonces',   ctrl.getAnnonces);
router.get('/:id/evenements', ctrl.getEvenements);

module.exports = router;
