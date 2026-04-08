const Joi = require('joi');

const updateSchema = Joi.object({
  nom:       Joi.string().min(2).max(100),
  prenom:    Joi.string().min(2).max(100),
  telephone: Joi.string().max(20).allow('', null),
  langue:    Joi.string().valid('fr', 'en'),
}).min(1);

const addQuartierSchema = Joi.object({
  id_quartier: Joi.number().integer().required(),
});

module.exports = { updateSchema, addQuartierSchema };
