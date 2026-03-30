const express = require('express');
const router  = express.Router();

const ctrl     = require('../controllers/annonces.controller');
const auth     = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { createSchema, updateSchema } = require('../validators/annonce.validator');

router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/',   auth, validate(createSchema), ctrl.create);
router.put('/:id', auth, validate(updateSchema), ctrl.update);
router.delete('/:id', auth, ctrl.remove);

router.get('/:id/contrat', auth, ctrl.getContrat);

module.exports = router;
