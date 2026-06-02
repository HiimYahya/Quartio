const Joi = require('joi');

const createSchema = Joi.object({
  type:         Joi.string().valid('privee', 'groupe', 'publique').default('privee'),
  nom:          Joi.string().max(200).allow('', null),
  participants: Joi.array().items(Joi.number().integer()).min(1).required(),
});

const messageSchema = Joi.object({
  type:      Joi.string().valid('texte', 'image', 'video', 'fichier').default('texte'),
  contenu:   Joi.string().allow('', null),
  media_url: Joi.string().allow('', null),
});

module.exports = { createSchema, messageSchema };
