// Règles minimales : 8 caractères, 1 majuscule, 1 chiffre, 1 caractère spécial
// (alignées sur PASSWORD_PATTERN côté API - api-rest-pa/src/validators/auth.validator.js)
export const PASSWORD_RULES = [
  { label: '8 caractères minimum', test: (pw) => pw.length >= 8 },
  { label: '1 majuscule',          test: (pw) => /[A-Z]/.test(pw) },
  { label: '1 chiffre',            test: (pw) => /[0-9]/.test(pw) },
  { label: '1 caractère spécial',  test: (pw) => /[^A-Za-z0-9]/.test(pw) },
]

export const isPasswordValid = (pw) => PASSWORD_RULES.every((r) => r.test(pw))

export const PASSWORD_RULES_MESSAGE = 'Le mot de passe doit contenir au moins 8 caractères, 1 majuscule, 1 chiffre et 1 caractère spécial'
