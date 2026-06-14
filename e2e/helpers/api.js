const db = require('./db');

const API_URL = 'http://localhost:3000/api';

const uniqueEmail = (prefix) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@e2e-quartio.com`;

// Inscrit, vérifie (via le code OTP lu en base) et connecte un utilisateur
// directement par l'API - utilisé pour préparer les données nécessaires aux
// scénarios E2E (ex: un vendeur avec une annonce payante) sans repasser par
// l'UI à chaque fois.
async function registerAndVerify({ nom, prenom, email, mot_de_passe = 'Password123', role } = {}) {
  email = email || uniqueEmail(prenom?.toLowerCase() || 'user');

  const reg = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom, prenom, email, mot_de_passe }),
  }).then((r) => r.json());

  const code = await db.getVerificationCode(email);
  await fetch(`${API_URL}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });

  if (role) {
    await db.setRole(email, role);
  }

  const login = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, mot_de_passe }),
  }).then((r) => r.json());

  return { id: reg.utilisateur?.id_utilisateur, email, mot_de_passe, ...login };
}

async function getFirstQuartierId() {
  const body = await fetch(`${API_URL}/quartiers?limit=1`).then((r) => r.json());
  return body.data?.[0]?.id_quartier;
}

async function createAnnonce(token, payload) {
  return fetch(`${API_URL}/annonces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  }).then((r) => r.json());
}

module.exports = { uniqueEmail, registerAndVerify, getFirstQuartierId, createAnnonce, API_URL };
