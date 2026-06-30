const Joi = require('joi');

const createSchema = Joi.object({
  points_echanges: Joi.number().integer().min(0).default(0),
  id_annonce_mongo: Joi.string().allow('', null),
});

const statutSchema = Joi.object({
  statut: Joi.string().valid('en_attente', 'signe', 'annule', 'termine', 'litige').required(),
});

const signerSchema = Joi.object({
  signature_dataurl: Joi.string().allow('', null),
  pdf_base64: Joi.string().allow('', null),
  mfa_code: Joi.string().pattern(/^[0-9]{6}$/).allow('', null),
});

const litigeSchema = Joi.object({
  motif: Joi.string().min(5).max(1000).required(),
});

const resoudreLitigeSchema = Joi.object({
  action: Joi.string().valid('rembourser', 'clore').required(),
  note:   Joi.string().max(1000).allow('', null),
});

module.exports = { createSchema, statutSchema, signerSchema, litigeSchema, resoudreLitigeSchema };
