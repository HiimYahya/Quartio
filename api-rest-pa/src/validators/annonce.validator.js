const Joi = require('joi');
const { CATEGORIE_PATTERN, CATEGORIE_MESSAGE, texteLibre } = require('./formats');

const categorieSchema = Joi.string().min(2).max(100).pattern(CATEGORIE_PATTERN)
  .messages({ 'string.pattern.base': CATEGORIE_MESSAGE });

const typeSchema = Joi.string().min(2).max(50).pattern(CATEGORIE_PATTERN)
  .messages({ 'string.pattern.base': CATEGORIE_MESSAGE });

const createSchema = Joi.object({
  titre:          texteLibre(2, 200).required(),
  description:    texteLibre(1, 5000).allow('', null),
  type:           typeSchema.allow('', null),
  est_payant:     Joi.boolean().default(false),
  cout_points:    Joi.number().integer().min(0).default(0),
  categorie:      categorieSchema.allow('', null),
  type_concerne:  categorieSchema.allow('', null),
  id_quartier:    Joi.number().integer().allow(null),
});

const updateSchema = Joi.object({
  titre:       texteLibre(2, 200),
  description: texteLibre(1, 5000).allow('', null),
  type:        typeSchema.allow('', null),
  est_payant:  Joi.boolean(),
  cout_points: Joi.number().integer().min(0),
  categorie:   categorieSchema.allow('', null),
  statut:      Joi.string().valid('active', 'inactive', 'archivee'),
}).min(1);

module.exports = { createSchema, updateSchema };
