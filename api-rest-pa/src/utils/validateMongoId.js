const { isValidObjectId } = require('mongoose');

/**
 * Vérifie qu'un ID MongoDB est valide.
 * Retourne false et envoie une réponse 400 si invalide.
 */
const validateMongoId = (id, res) => {
  if (!isValidObjectId(id)) {
    res.status(400).json({ error: 'ID invalide' });
    return false;
  }
  return true;
};

module.exports = validateMongoId;
