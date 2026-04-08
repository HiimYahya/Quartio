const express = require('express');
const router  = express.Router();

const ctrl     = require('../controllers/contrats.controller');
const auth     = require('../middlewares/auth.middleware');
const role     = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { createSchema, statutSchema } = require('../validators/contrat.validator');

router.get('/',    auth, ctrl.getMes);
router.get('/:id', auth, ctrl.getById);
router.post('/',   auth, validate(createSchema), ctrl.create);

router.put('/:id/signer', auth, ctrl.signer);
router.put('/:id/statut', auth, role('admin'), validate(statutSchema), ctrl.updateStatut);

module.exports = router;
