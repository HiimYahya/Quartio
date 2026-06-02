const Joi = require('joi');

const createSchema = Joi.object({
  nom:       Joi.string().min(2).max(100).required(),
  geometrie: Joi.string().optional().allow('', null),
});

const updateSchema = Joi.object({
  nom:       Joi.string().min(2).max(100),
  geometrie: Joi.string().optional().allow('', null),
}).min(1);

module.exports = { createSchema, updateSchema };
