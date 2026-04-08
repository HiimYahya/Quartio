const Joi = require('joi');

const createSchema = Joi.object({
  points_echanges: Joi.number().integer().min(0).default(0),
  id_annonce_mongo: Joi.string().allow('', null),
});

const statutSchema = Joi.object({
  statut: Joi.string().valid('en_attente', 'signe', 'annule', 'termine').required(),
});

module.exports = { createSchema, statutSchema };
