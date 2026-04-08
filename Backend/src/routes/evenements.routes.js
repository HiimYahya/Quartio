const express = require('express');
const router  = express.Router();

const ctrl     = require('../controllers/evenements.controller');
const auth     = require('../middlewares/auth.middleware');
const role     = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { createSchema, updateSchema } = require('../validators/evenement.validator');

router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/',   auth, validate(createSchema), ctrl.create);
router.put('/:id', auth, validate(updateSchema), ctrl.update);
router.delete('/:id', auth, role('admin'), ctrl.remove);

router.post('/:id/participer',      auth, ctrl.participer);
router.delete('/:id/participer',    auth, ctrl.seDesinscrire);
router.get('/:id/participants',     auth, ctrl.getParticipants);

module.exports = router;
