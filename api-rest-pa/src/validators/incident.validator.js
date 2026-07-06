const Joi = require('joi');

const createSchema = Joi.object({
  titre:       Joi.string().min(2).max(200).required(),
  description: Joi.string().allow('', null),
  type:        Joi.string().max(50).allow('', null),
  priorite:    Joi.string().valid('basse', 'normale', 'haute', 'critique').default('normale'),
});

const updateSchema = Joi.object({
  titre:           Joi.string().min(2).max(200),
  description:     Joi.string().allow('', null),
  type:            Joi.string().max(50).allow('', null),
  statut:          Joi.string().valid('ouvert', 'en_cours', 'resolu', 'ferme'),
  priorite:        Joi.string().valid('basse', 'normale', 'haute', 'critique'),
  date_resolution: Joi.date().allow(null),
  est_synchronise: Joi.boolean(),
  id_moderateur:   Joi.number().integer().allow(null),
}).min(1);

module.exports = { createSchema, updateSchema };
