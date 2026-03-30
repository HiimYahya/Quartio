const Joi = require('joi');

const createSchema = Joi.object({
  titre:       Joi.string().min(2).max(200).required(),
  description: Joi.string().allow('', null),
  type:        Joi.string().max(50).allow('', null),
  priorite:    Joi.string().valid('basse', 'normale', 'haute', 'critique').default('normale'),
});

const updateSchema = Joi.object({
  statut:          Joi.string().valid('ouvert', 'en_cours', 'resolu', 'ferme'),
  priorite:        Joi.string().valid('basse', 'normale', 'haute', 'critique'),
  date_resolution: Joi.date().allow(null),
  est_synchronise: Joi.boolean(),
}).min(1);

module.exports = { createSchema, updateSchema };
