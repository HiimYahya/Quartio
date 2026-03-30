const Joi = require('joi');

const createSchema = Joi.object({
  titre:          Joi.string().min(2).max(200).required(),
  description:    Joi.string().allow('', null),
  type:           Joi.string().max(50).allow('', null),
  est_payant:     Joi.boolean().default(false),
  cout_points:    Joi.number().integer().min(0).default(0),
  categorie:      Joi.string().max(100).allow('', null),
  type_concerne:  Joi.string().max(100).allow('', null),
  id_quartier:    Joi.number().integer().required(),
});

const updateSchema = Joi.object({
  titre:       Joi.string().min(2).max(200),
  description: Joi.string().allow('', null),
  type:        Joi.string().max(50).allow('', null),
  est_payant:  Joi.boolean(),
  cout_points: Joi.number().integer().min(0),
  categorie:   Joi.string().max(100).allow('', null),
  statut:      Joi.string().valid('active', 'inactive', 'archivee'),
}).min(1);

module.exports = { createSchema, updateSchema };
