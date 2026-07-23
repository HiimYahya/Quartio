const pool = require('../config/db');
const logger = require('../config/logger');

const createNotification = async (id_utilisateur, type, titre, contenu, id_ressource = null, type_ressource = null) => {
  try {
    if (type !== 'systeme') {
      const { rows } = await pool.query(
        'SELECT notif_prefs FROM utilisateur WHERE id_utilisateur = $1', [id_utilisateur]
      );
      const prefs = rows[0]?.notif_prefs;
      if (prefs && prefs[type] === false) return null;
    }

    const { rows: inserted } = await pool.query(
      `INSERT INTO notification (id_utilisateur, type, titre, contenu, id_ressource, type_ressource)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id_utilisateur, type, titre, contenu, id_ressource?.toString() || null, type_ressource]
    );
    return inserted[0];
  } catch (err) {
    logger.error('Erreur création notification', { err: err.message, id_utilisateur, type });
    return null;
  }
};

module.exports = { createNotification };
