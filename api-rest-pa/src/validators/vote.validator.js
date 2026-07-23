const Joi = require('joi');
const { CATEGORIE_PATTERN, CATEGORIE_MESSAGE, texteLibre, dateNonPassee } = require('./formats');

const optionSchema = Joi.object({
  libelle: texteLibre(1, 200).required(),
  ordre:   Joi.number().integer().default(0),
});

const createSchema = Joi.object({
  titre:        texteLibre(2, 200).required(),
  description:  texteLibre(1, 5000).allow('', null),
  type:         Joi.string().min(2).max(50).pattern(CATEGORIE_PATTERN)
    .messages({ 'string.pattern.base': CATEGORIE_MESSAGE }).allow('', null),
  type_vote:    Joi.string().valid('choix_multiple', 'oui_non', 'classement').default('choix_multiple'),
  nb_choix_max: Joi.number().integer().min(1).default(1),
  date_debut:   Joi.date().custom(dateNonPassee).allow(null),
  date_fin:     Joi.date().custom(dateNonPassee).allow(null)
    .when('date_debut', { is: Joi.exist(), then: Joi.date().min(Joi.ref('date_debut')) })
    .messages({ 'date.min': 'La date de fin ne peut pas être antérieure à la date de début' }),
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
  titre:       texteLibre(2, 200),
  description: texteLibre(1, 5000).allow('', null),
  statut:      Joi.string().valid('ouvert', 'ferme', 'archive'),
}).min(1);

const voterSchema = Joi.object({
  id_option: Joi.number().integer().required(),
});

module.exports = { createSchema, updateSchema, voterSchema };
