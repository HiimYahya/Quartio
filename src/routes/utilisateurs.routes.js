const express = require('express');
const router  = express.Router();

const ctrl     = require('../controllers/utilisateurs.controller');
const auth     = require('../middlewares/auth.middleware');
const role     = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { updateSchema, addQuartierSchema } = require('../validators/utilisateur.validator');

router.get('/',    auth, role('admin'), ctrl.getAll);
router.get('/:id', auth, ctrl.getById);
router.put('/:id', auth, validate(updateSchema), ctrl.update);
router.delete('/:id', auth, role('admin'), ctrl.remove);

router.post('/:id/quartier',          auth, validate(addQuartierSchema), ctrl.addQuartier);
router.delete('/:id/quartier/:idQ',   auth, ctrl.removeQuartier);
router.get('/:id/transactions',       auth, ctrl.getTransactions);

module.exports = router;
