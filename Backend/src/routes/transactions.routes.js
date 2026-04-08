const express = require('express');
const router  = express.Router();

const ctrl = require('../controllers/transactions.controller');
const auth = require('../middlewares/auth.middleware');

router.get('/',    auth, ctrl.getMes);
router.get('/:id', auth, ctrl.getById);

module.exports = router;
