const Joi = require('joi');
const { passwordSchema } = require('./auth.validator');

const updateSchema = Joi.object({
  nom:       Joi.string().min(2).max(100),
  prenom:    Joi.string().min(2).max(100),
  telephone: Joi.string().max(20).allow('', null),
  langue:    Joi.string().valid('fr', 'en'),
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
  telephone: Joi.string().max(20).allow('', null).required(),
  mfa_code:  Joi.string().length(6).optional(),
});

module.exports = {
  updateSchema, addQuartierSchema,
  changePasswordSchema, changeEmailSchema, changeTelephoneSchema,
};
