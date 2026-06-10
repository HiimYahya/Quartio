const express = require('express');
const router  = express.Router();

router.use('/auth',          require('./auth.routes'));
router.use('/auth/mfa',      require('./mfa.routes'));
router.use('/utilisateurs',  require('./utilisateurs.routes'));
router.use('/quartiers',     require('./quartiers.routes'));
router.use('/annonces',      require('./annonces.routes'));
router.use('/evenements',    require('./evenements.routes'));
router.use('/votes',         require('./votes.routes'));
router.use('/conversations', require('./conversations.routes'));
router.use('/messages',      require('./messages.routes'));
router.use('/contrats',      require('./contrats.routes'));
router.use('/transactions',  require('./transactions.routes'));
router.use('/incidents',      require('./incidents.routes'));
router.use('/notifications',  require('./notifications.routes'));
router.use('/rgpd',           require('./rgpd.routes'));
router.use('/stats',          require('./stats.routes'));
router.use('/query',          require('./query.routes'));

module.exports = router;
