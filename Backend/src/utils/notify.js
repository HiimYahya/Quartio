const pool = require('../config/db');
const logger = require('../config/logger');

/**
 * Crée une notification pour un utilisateur.
 * Fire-and-forget : une erreur ici ne fait pas planter l'opération principale.
 *
 * @param {number} id_utilisateur  - destinataire
 * @param {string} type            - 'message' | 'evenement' | 'contrat' | 'vote' | 'incident'
 * @param {string} titre           - titre court de la notification
 * @param {string} contenu         - description détaillée
 * @param {string} id_ressource    - ID de la ressource liée (string, peut être un ID Mongo ou PG)
 * @param {string} type_ressource  - type de la ressource ('annonce', 'evenement', etc.)
 */
const createNotification = async (id_utilisateur, type, titre, contenu, id_ressource = null, type_ressource = null) => {
  try {
    await pool.query(
      `INSERT INTO notification (id_utilisateur, type, titre, contenu, id_ressource, type_ressource)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id_utilisateur, type, titre, contenu, id_ressource?.toString() || null, type_ressource]
    );
  } catch (err) {
    logger.error('Erreur création notification', { err: err.message, id_utilisateur, type });
  }
};

module.exports = { createNotification };
