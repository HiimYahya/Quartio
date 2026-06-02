const express = require('express');
const router  = express.Router();

const ctrl = require('../controllers/messages.controller');
const auth = require('../middlewares/auth.middleware');

router.delete('/:id',          auth, ctrl.remove);
router.post('/:id/signaler',   auth, ctrl.signaler);

module.exports = router;
