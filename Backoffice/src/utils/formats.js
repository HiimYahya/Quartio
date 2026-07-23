// Miroir des formats du backend : on bloque le n'importe quoi (@@##...),
// pas les usages légitimes.

export const CATEGORIE_REGEX = /^[\p{L}0-9][\p{L}0-9 _&'-]*$/u
export const CATEGORIE_AIDE  = 'Lettres, chiffres, espaces et & \' - _ uniquement'

export const LIEU_REGEX = /^[\p{L}0-9][\p{L}0-9 ,.'()°/-]*$/u
export const LIEU_AIDE  = 'Lettres, chiffres et ponctuation courante d\'une adresse uniquement'

export const TELEPHONE_REGEX = /^\+?[0-9][0-9 ()./-]{5,18}$/
export const TELEPHONE_AIDE  = 'Numéro de téléphone valide (chiffres, espaces, + . - ( ) acceptés)'

export const NOM_REGEX = /^[\p{L}][\p{L}' -]*$/u
export const NOM_AIDE  = 'Lettres, espaces, apostrophes et tirets uniquement'

export const TEXTE_REGEX = /[\p{L}0-9]/u
export const TEXTE_AIDE  = 'Doit contenir au moins une lettre ou un chiffre'

// `min` pour un <input type="datetime-local"> : maintenant, en heure locale
export const datetimeLocalMin = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}
