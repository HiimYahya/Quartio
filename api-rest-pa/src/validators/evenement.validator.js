const Joi = require('joi');
const {
  CATEGORIE_PATTERN, CATEGORIE_MESSAGE,
  LIEU_PATTERN, LIEU_MESSAGE,
  texteLibre, dateNonPassee,
} = require('./formats');

const lieuSchema = Joi.string().min(3).max(200).pattern(LIEU_PATTERN)
  .messages({ 'string.pattern.base': LIEU_MESSAGE });

const typeSchema = Joi.string().min(2).max(50).pattern(CATEGORIE_PATTERN)
  .messages({ 'string.pattern.base': CATEGORIE_MESSAGE });

const createSchema = Joi.object({
  titre:        texteLibre(2, 200).required(),
  description:  texteLibre(1, 5000).allow('', null),
  type:         typeSchema.allow('', null),
  date_debut:   Joi.date().custom(dateNonPassee).required(),
  date_fin:     Joi.date().min(Joi.ref('date_debut')).allow(null)
    .messages({ 'date.min': 'La date de fin ne peut pas être antérieure à la date de début' }),
  lieu:         lieuSchema.allow('', null),
  capacite_max: Joi.number().integer().min(1).allow(null),
  id_quartier:  Joi.number().integer().allow(null),
});

const updateSchema = Joi.object({
  titre:        texteLibre(2, 200),
  description:  texteLibre(1, 5000).allow('', null),
  type:         typeSchema.allow('', null),
  date_debut:   Joi.date().custom(dateNonPassee),
  date_fin:     Joi.date().allow(null)
    .when('date_debut', { is: Joi.exist(), then: Joi.date().min(Joi.ref('date_debut')) })
    .messages({ 'date.min': 'La date de fin ne peut pas être antérieure à la date de début' }),
  lieu:         lieuSchema.allow('', null),
  capacite_max: Joi.number().integer().min(1).allow(null),
  statut:       Joi.string().valid('planifie', 'en_cours', 'termine', 'annule'),
}).min(1);

module.exports = { createSchema, updateSchema };
