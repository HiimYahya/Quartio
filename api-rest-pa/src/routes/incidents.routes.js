const express = require('express');
const router  = express.Router();

const ctrl     = require('../controllers/incidents.controller');
const auth     = require('../middlewares/auth.middleware');
const role     = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { createSchema, updateSchema } = require('../validators/incident.validator');

router.get('/',    auth, role('admin'), ctrl.getAll);
router.get('/:id', auth, ctrl.getById);
router.post('/',   auth, validate(createSchema), ctrl.create);
router.put('/:id', auth, role('admin'), validate(updateSchema), ctrl.update);
router.delete('/:id', auth, role('admin'), ctrl.remove);

module.exports = router;
