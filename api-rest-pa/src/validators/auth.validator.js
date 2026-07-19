const Joi = require('joi');

const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE = 'Le mot de passe doit contenir au moins 8 caractères, 1 majuscule, 1 chiffre et 1 caractère spécial';

const passwordSchema = Joi.string().pattern(PASSWORD_PATTERN).required().messages({
  'string.pattern.base': PASSWORD_MESSAGE,
});

const registerSchema = Joi.object({
  nom:          Joi.string().min(2).max(100).required(),
  prenom:       Joi.string().min(2).max(100).required(),
  email:        Joi.string().email().required(),
  mot_de_passe: passwordSchema,
  telephone:    Joi.string().max(20).optional().allow(''),
  langue:       Joi.string().valid('fr', 'en').default('fr'),
});

const loginSchema = Joi.object({
  email:        Joi.string().email().required(),
  mot_de_passe: Joi.string().required(),
});

module.exports = { registerSchema, loginSchema, passwordSchema, PASSWORD_PATTERN, PASSWORD_MESSAGE };
