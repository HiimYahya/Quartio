const Joi = require('joi');

const registerSchema = Joi.object({
  nom:          Joi.string().min(2).max(100).required(),
  prenom:       Joi.string().min(2).max(100).required(),
  email:        Joi.string().email().required(),
  mot_de_passe: Joi.string().min(8).required(),
  telephone:    Joi.string().max(20).optional().allow(''),
  langue:       Joi.string().valid('fr', 'en').default('fr'),
});

const loginSchema = Joi.object({
  email:        Joi.string().email().required(),
  mot_de_passe: Joi.string().required(),
});

module.exports = { registerSchema, loginSchema };
