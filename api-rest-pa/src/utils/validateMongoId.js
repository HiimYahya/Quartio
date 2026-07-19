const { isValidObjectId } = require('mongoose');

const validateMongoId = (id, res) => {
  if (!isValidObjectId(id)) {
    res.status(400).json({ error: 'ID invalide' });
    return false;
  }
  return true;
};

module.exports = validateMongoId;
