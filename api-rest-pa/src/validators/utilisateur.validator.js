const Joi = require('joi');
const { passwordSchema } = require('./auth.validator');
const {
  NOM_PATTERN, NOM_MESSAGE,
  TELEPHONE_PATTERN, TELEPHONE_MESSAGE,
} = require('./formats');

const nomSchema = Joi.string().min(2).max(100).pattern(NOM_PATTERN)
  .messages({ 'string.pattern.base': NOM_MESSAGE });

const telephoneSchema = Joi.string().max(20).pattern(TELEPHONE_PATTERN)
  .messages({ 'string.pattern.base': TELEPHONE_MESSAGE });

const updateSchema = Joi.object({
  nom:       nomSchema,
  prenom:    nomSchema,
  telephone: telephoneSchema.allow('', null),
  langue:    Joi.string().valid('fr', 'en'),
  role:      Joi.string().valid('user', 'admin', 'moderateur'),
}).min(1);

const addQuartierSchema = Joi.object({
  id_quartier: Joi.number().integer().required(),
});

const changePasswordSchema = Joi.object({
  ancien_mot_de_passe:   Joi.string().required(),
  nouveau_mot_de_passe:  passwordSchema,
  mfa_code:              Joi.string().length(6).optional(),
});

const changeEmailSchema = Joi.object({
  nouvel_email: Joi.string().email().required(),
  mfa_code:     Joi.string().length(6).optional(),
});

const changeTelephoneSchema = Joi.object({
  telephone: telephoneSchema.allow('', null).required(),
  mfa_code:  Joi.string().length(6).optional(),
});

module.exports = {
  updateSchema, addQuartierSchema,
  changePasswordSchema, changeEmailSchema, changeTelephoneSchema,
};
