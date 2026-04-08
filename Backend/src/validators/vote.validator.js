const Joi = require('joi');

const createSchema = Joi.object({
  titre:       Joi.string().min(2).max(200).required(),
  description: Joi.string().allow('', null),
  type:        Joi.string().max(50).allow('', null),
  date_debut:  Joi.date().allow(null),
  date_fin:    Joi.date().allow(null),
  est_anonyme: Joi.boolean().default(false),
  options:     Joi.array().items(
    Joi.object({
      libelle: Joi.string().required(),
      ordre:   Joi.number().integer().default(0),
    })
  ).min(2).required(),
  id_themes: Joi.array().items(Joi.number().integer()).default([]),
});

const updateSchema = Joi.object({
  titre:       Joi.string().min(2).max(200),
  description: Joi.string().allow('', null),
  statut:      Joi.string().valid('ouvert', 'ferme', 'archive'),
}).min(1);

const voterSchema = Joi.object({
  id_option: Joi.number().integer().required(),
});

module.exports = { createSchema, updateSchema, voterSchema };
