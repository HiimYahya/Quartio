const logger = require('../config/logger');

// Exemple de hook : journalise les événements métier importants.
// Sert aussi de modèle pour ajouter de nouveaux hooks sans toucher
// aux controllers qui émettent ces événements.
module.exports = (appEvents) => {
  appEvents.on('contrat.finalise', ({ contratId, idVendeur, idAcheteur, points }) => {
    logger.info(`[hook] contrat.finalise #${contratId} - vendeur=${idVendeur} acheteur=${idAcheteur} points=${points}`);
  });

  appEvents.on('incident.cree', ({ incidentId, priorite }) => {
    logger.info(`[hook] incident.cree #${incidentId} - priorité=${priorite}`);
  });
};
