const Joi = require('joi');

const optionSchema = Joi.object({
  libelle: Joi.string().required(),
  ordre:   Joi.number().integer().default(0),
});

const createSchema = Joi.object({
  titre:        Joi.string().min(2).max(200).required(),
  description:  Joi.string().allow('', null),
  type:         Joi.string().max(50).allow('', null),
  type_vote:    Joi.string().valid('choix_multiple', 'oui_non', 'classement').default('choix_multiple'),
  nb_choix_max: Joi.number().integer().min(1).default(1),
  date_debut:   Joi.date().allow(null),
  date_fin:     Joi.date().allow(null),
  est_anonyme:  Joi.boolean().default(false),
  options: Joi.when('type_vote', {
    is:        'oui_non',
    then:      Joi.array().items(optionSchema).default([]),
    otherwise: Joi.array().items(optionSchema).min(2).required(),
  }),
  id_themes:   Joi.array().items(Joi.number().integer()).default([]),
  id_quartier: Joi.number().integer().allow(null),
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
