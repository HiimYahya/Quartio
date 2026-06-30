const fs   = require('fs');
const path = require('path');

// Charge tous les fichiers `*.hook.js` de ce dossier : chacun reçoit le bus
// d'événements de l'application et s'abonne aux événements qui l'intéressent
// (ex: 'contrat.finalise', 'incident.cree').
//
// Ajouter un nouveau module qui réagit à un événement métier ne nécessite
// donc aucune modification des controllers existants ni de ce fichier :
// il suffit de déposer un fichier `<nom>.hook.js` ici.
module.exports = (appEvents) => {
  fs.readdirSync(__dirname)
    .filter((file) => file.endsWith('.hook.js'))
    .sort()
    .forEach((file) => require(path.join(__dirname, file))(appEvents));
};
