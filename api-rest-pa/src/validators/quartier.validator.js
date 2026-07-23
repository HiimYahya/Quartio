const Joi = require('joi');
const { CATEGORIE_PATTERN, CATEGORIE_MESSAGE } = require('./formats');

const nomSchema = Joi.string().min(2).max(100).pattern(CATEGORIE_PATTERN)
  .messages({ 'string.pattern.base': CATEGORIE_MESSAGE });

const createSchema = Joi.object({
  nom:       nomSchema.required(),
  geometrie: Joi.string().optional().allow('', null),
});

const updateSchema = Joi.object({
  nom:       nomSchema,
  geometrie: Joi.string().optional().allow('', null),
}).min(1);

module.exports = { createSchema, updateSchema };
