const express = require('express');
const router  = express.Router();

const ctrl     = require('../controllers/votes.controller');
const auth     = require('../middlewares/auth.middleware');
const role     = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { createSchema, updateSchema, voterSchema } = require('../validators/vote.validator');

router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/',   auth, validate(createSchema), ctrl.create);
router.put('/:id', auth, validate(updateSchema), ctrl.update);
router.delete('/:id', auth, role('admin'), ctrl.remove);

router.post('/:id/voter',     auth, validate(voterSchema), ctrl.voter);
router.get('/:id/resultats',  auth, ctrl.getResultats);

module.exports = router;
