const Joi = require('joi');

// Formats partagés par les validators. Volontairement permissifs : on veut
// bloquer le n'importe quoi (@@##...), pas restreindre les usages légitimes.

const NOM_PATTERN = /^[\p{L}][\p{L}' -]*$/u;
const NOM_MESSAGE = '{#label} ne peut contenir que des lettres, espaces, apostrophes ou tirets';

const CATEGORIE_PATTERN = /^[\p{L}0-9][\p{L}0-9 _&'-]*$/u;
const CATEGORIE_MESSAGE = '{#label} ne peut contenir que des lettres, chiffres, espaces et & \' - _';

const LIEU_PATTERN = /^[\p{L}0-9][\p{L}0-9 ,.'()°/-]*$/u;
const LIEU_MESSAGE = '{#label} ne peut contenir que des lettres, chiffres et la ponctuation courante d\'une adresse';

const TELEPHONE_PATTERN = /^\+?[0-9][0-9 ()./-]{5,18}$/;
const TELEPHONE_MESSAGE = '{#label} doit être un numéro de téléphone valide (chiffres, espaces, + . - ( ) acceptés)';

const TEXTE_PATTERN = /[\p{L}0-9]/u;
const TEXTE_MESSAGE = '{#label} doit contenir au moins une lettre ou un chiffre';

const texteLibre = (min, max) =>
  Joi.string().min(min).max(max).pattern(TEXTE_PATTERN)
    .messages({ 'string.pattern.base': TEXTE_MESSAGE });

// Pour Joi .custom() : refuse une date antérieure à aujourd'hui (minuit)
const dateNonPassee = (value, helpers) => {
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  if (value < aujourdhui) {
    return helpers.message('{#label} ne peut pas être antérieure à aujourd\'hui');
  }
  return value;
};

module.exports = {
  NOM_PATTERN, NOM_MESSAGE,
  CATEGORIE_PATTERN, CATEGORIE_MESSAGE,
  LIEU_PATTERN, LIEU_MESSAGE,
  TELEPHONE_PATTERN, TELEPHONE_MESSAGE,
  TEXTE_PATTERN, TEXTE_MESSAGE,
  texteLibre, dateNonPassee,
};
