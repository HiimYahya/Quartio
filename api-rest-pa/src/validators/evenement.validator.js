const Joi = require('joi');

const createSchema = Joi.object({
  titre:        Joi.string().min(2).max(200).required(),
  description:  Joi.string().allow('', null),
  type:         Joi.string().max(50).allow('', null),
  date_debut:   Joi.date().required(),
  date_fin:     Joi.date().allow(null),
  lieu:         Joi.string().max(200).allow('', null),
  capacite_max: Joi.number().integer().min(1).allow(null),
  id_quartier:  Joi.number().integer().required(),
});

const updateSchema = Joi.object({
  titre:        Joi.string().min(2).max(200),
  description:  Joi.string().allow('', null),
  type:         Joi.string().max(50).allow('', null),
  date_debut:   Joi.date(),
  date_fin:     Joi.date().allow(null),
  lieu:         Joi.string().max(200).allow('', null),
  capacite_max: Joi.number().integer().min(1).allow(null),
  statut:       Joi.string().valid('planifie', 'en_cours', 'termine', 'annule'),
}).min(1);

module.exports = { createSchema, updateSchema };
