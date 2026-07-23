const Joi = require('joi');
const {
  NOM_PATTERN, NOM_MESSAGE,
  LIEU_PATTERN, LIEU_MESSAGE,
  TELEPHONE_PATTERN, TELEPHONE_MESSAGE,
} = require('./formats');

const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE = 'Le mot de passe doit contenir au moins 8 caractères, 1 majuscule, 1 chiffre et 1 caractère spécial';

const passwordSchema = Joi.string().pattern(PASSWORD_PATTERN).required().messages({
  'string.pattern.base': PASSWORD_MESSAGE,
});

const nomSchema = Joi.string().min(2).max(100).pattern(NOM_PATTERN)
  .messages({ 'string.pattern.base': NOM_MESSAGE });

const registerSchema = Joi.object({
  nom:          nomSchema.required(),
  prenom:       nomSchema.required(),
  email:        Joi.string().email().required(),
  mot_de_passe: passwordSchema,
  adresse:      Joi.string().min(3).max(255).pattern(LIEU_PATTERN)
    .messages({ 'string.pattern.base': LIEU_MESSAGE }).allow('', null),
  telephone:    Joi.string().max(20).pattern(TELEPHONE_PATTERN)
    .messages({ 'string.pattern.base': TELEPHONE_MESSAGE }).optional().allow(''),
  langue:       Joi.string().valid('fr', 'en').default('fr'),
});

const loginSchema = Joi.object({
  email:        Joi.string().email().required(),
  mot_de_passe: Joi.string().required(),
});

module.exports = { registerSchema, loginSchema, passwordSchema, PASSWORD_PATTERN, PASSWORD_MESSAGE };
