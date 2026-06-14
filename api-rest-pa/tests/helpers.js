const request = require('supertest');
const app     = require('../src/app');
const pool    = require('../src/config/db');

// Génère un email unique pour éviter les collisions entre tests
const uniqueEmail = (prefix) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@test.com`;

// Inscrit un utilisateur, récupère le code de vérification en base (pas d'envoi
// d'email réel en test), valide l'email, puis se connecte.
// Retourne le profil + les tokens. Le rôle peut être forcé (ex: 'admin').
const registerAndVerify = async ({ nom = 'Test', prenom = 'User', email, mot_de_passe = 'Password123', role } = {}) => {
  email = email || uniqueEmail('user');

  const reg = await request(app)
    .post('/api/auth/register')
    .send({ nom, prenom, email, mot_de_passe });

  const id = reg.body.utilisateur.id_utilisateur;

  const { rows } = await pool.query(
    `SELECT code FROM email_verification
     WHERE id_utilisateur = $1 ORDER BY created_at DESC LIMIT 1`,
    [id]
  );
  const code = rows[0].code;

  await request(app).post('/api/auth/verify-email').send({ email, code });

  if (role) {
    await pool.query('UPDATE utilisateur SET role = $1 WHERE id_utilisateur = $2', [role, id]);
  }

  const login = await request(app).post('/api/auth/login').send({ email, mot_de_passe });

  return { id, email, mot_de_passe, ...login.body };
};

module.exports = { uniqueEmail, registerAndVerify };
