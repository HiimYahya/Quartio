const express = require('express');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();

const ROUTE_OVERRIDES = {
  'mfa.routes.js': '/auth/mfa',
};

fs.readdirSync(__dirname)
  .filter((file) => file.endsWith('.routes.js'))
  .sort()
  .forEach((file) => {
    const mountPath = ROUTE_OVERRIDES[file] || `/${file.replace('.routes.js', '')}`;
    router.use(mountPath, require(path.join(__dirname, file)));
  });

module.exports = router;
