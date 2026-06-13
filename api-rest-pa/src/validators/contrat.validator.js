const Joi = require('joi');

const createSchema = Joi.object({
  points_echanges: Joi.number().integer().min(0).default(0),
  id_annonce_mongo: Joi.string().allow('', null),
});

const statutSchema = Joi.object({
  statut: Joi.string().valid('en_attente', 'signe', 'annule', 'termine').required(),
});

const signerSchema = Joi.object({
  signature_dataurl: Joi.string().allow('', null),
  pdf_base64: Joi.string().allow('', null),
  mfa_code: Joi.string().pattern(/^[0-9]{6}$/).allow('', null),
});

module.exports = { createSchema, statutSchema, signerSchema };
