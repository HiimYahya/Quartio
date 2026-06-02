const express = require('express');
const router  = express.Router();

const ctrl     = require('../controllers/conversations.controller');
const auth     = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { createSchema, messageSchema } = require('../validators/conversation.validator');

router.get('/',    auth, ctrl.getMes);
router.get('/:id', auth, ctrl.getById);
router.post('/',   auth, validate(createSchema), ctrl.create);

router.get('/:id/messages',  auth, ctrl.getMessages);
router.post('/:id/messages', auth, validate(messageSchema), ctrl.envoyerMessage);

module.exports = router;
