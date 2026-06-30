const express = require('express');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();

// ── Route registry ───────────────────────────────────────────────────────────
// Convention : chaque fichier `<nom>.routes.js` de ce dossier est monté
// automatiquement sur `/<nom>` (ex: `annonces.routes.js` -> `/api/annonces`).
// Pour les cas où le chemin de montage diffère du nom de fichier, ajouter une
// entrée dans ROUTE_OVERRIDES.
//
// Un nouveau module (ex: `taches.routes.js`) n'a donc besoin d'aucune
// modification de ce fichier : il est chargé et monté automatiquement.
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
