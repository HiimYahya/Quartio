const Joi = require('joi');
const { CATEGORIE_PATTERN, CATEGORIE_MESSAGE, texteLibre } = require('./formats');

const typeSchema = Joi.string().min(2).max(50).pattern(CATEGORIE_PATTERN)
  .messages({ 'string.pattern.base': CATEGORIE_MESSAGE });

const createSchema = Joi.object({
  titre:       texteLibre(2, 200).required(),
  description: texteLibre(1, 5000).allow('', null),
  type:        typeSchema.allow('', null),
  priorite:    Joi.string().valid('basse', 'normale', 'haute', 'critique').default('normale'),
});

const updateSchema = Joi.object({
  titre:           texteLibre(2, 200),
  description:     texteLibre(1, 5000).allow('', null),
  type:            typeSchema.allow('', null),
  statut:          Joi.string().valid('ouvert', 'en_cours', 'resolu', 'ferme'),
  priorite:        Joi.string().valid('basse', 'normale', 'haute', 'critique'),
  date_resolution: Joi.date().allow(null),
  est_synchronise: Joi.boolean(),
  id_moderateur:   Joi.number().integer().allow(null),
}).min(1);

module.exports = { createSchema, updateSchema };
