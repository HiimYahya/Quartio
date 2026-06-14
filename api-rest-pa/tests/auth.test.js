const request    = require('supertest');
const speakeasy  = require('speakeasy');
const app        = require('../src/app');
const pool       = require('../src/config/db');
const { uniqueEmail, registerAndVerify } = require('./helpers');

// Ces tests nécessitent que les bases de données soient accessibles (intégration)
// Lance avec: docker-compose up -d && npm test

describe('POST /api/auth/register', () => {
  const email = uniqueEmail('register');

  it('crée un compte et demande la vérification de l\'email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Test', prenom: 'User', email, mot_de_passe: 'Password123' });

    expect(res.status).toBe(201);
    expect(res.body.email_verification_required).toBe(true);
    expect(res.body.utilisateur).toHaveProperty('email', email);
    expect(res.body).not.toHaveProperty('access_token');
  });

  it('retourne 409 si l\'email est déjà utilisé', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Test', prenom: 'User', email, mot_de_passe: 'Password123' });

    expect(res.status).toBe(409);
  });

  it('retourne 400 si le mot de passe est trop court', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Test', prenom: 'User', email: uniqueEmail('short'), mot_de_passe: '123' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/verify-email + /api/auth/resend-verification', () => {
  const email = uniqueEmail('verify');
  let userId;

  beforeAll(async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Verify', prenom: 'Test', email, mot_de_passe: 'Password123' });
    userId = reg.body.utilisateur.id_utilisateur;
  });

  it('retourne 400 avec un code invalide', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ email, code: '000000' });

    expect(res.status).toBe(400);
  });

  it('vérifie l\'email avec le bon code et crédite les points de bienvenue', async () => {
    const { rows } = await pool.query(
      `SELECT code FROM email_verification
       WHERE id_utilisateur = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ email, code: rows[0].code });

    expect(res.status).toBe(200);

    const { rows: userRows } = await pool.query(
      'SELECT email_verifie, points_solde FROM utilisateur WHERE id_utilisateur = $1', [userId]
    );
    expect(userRows[0].email_verifie).toBe(true);
    expect(parseInt(userRows[0].points_solde)).toBe(100);
  });

  it('retourne 400 si l\'email est déjà vérifié', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ email, code: '123456' });

    expect(res.status).toBe(400);
  });

  it('resend-verification répond toujours avec un message générique', async () => {
    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: uniqueEmail('inconnu') });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });
});

describe('POST /api/auth/login', () => {
  const email    = uniqueEmail('login');
  const password = 'Password123';

  it('bloque la connexion avant vérification de l\'email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Login', prenom: 'Test', email, mot_de_passe: password });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, mot_de_passe: password });

    expect(res.status).toBe(403);
    expect(res.body.email_verification_required).toBe(true);
  });

  it('retourne un token après vérification de l\'email', async () => {
    const { rows } = await pool.query(
      `SELECT u.id_utilisateur, ev.code FROM utilisateur u
       JOIN email_verification ev ON ev.id_utilisateur = u.id_utilisateur
       WHERE u.email = $1 ORDER BY ev.created_at DESC LIMIT 1`,
      [email]
    );
    await request(app).post('/api/auth/verify-email').send({ email, code: rows[0].code });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, mot_de_passe: password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
    expect(res.body.expires_in).toBe(3600);
  });

  it('retourne 401 avec un mauvais mot de passe', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, mot_de_passe: 'wrongpassword' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  let token;
  const email = uniqueEmail('me');

  beforeAll(async () => {
    const user = await registerAndVerify({ email, nom: 'Me', prenom: 'Test' });
    token = user.access_token;
  });

  it('retourne le profil de l\'utilisateur connecté', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email', email);
  });

  it('retourne 401 sans token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh + /api/auth/logout', () => {
  let refreshToken;

  beforeAll(async () => {
    const user = await registerAndVerify({ nom: 'Ref', prenom: 'Test' });
    refreshToken = user.refresh_token;
  });

  it('retourne un nouveau access_token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: refreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
  });

  it('retourne 401 avec un token invalide', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: 'invalid_token' });

    expect(res.status).toBe(401);
  });

  it('logout révoque le refresh token', async () => {
    const logout = await request(app)
      .post('/api/auth/logout')
      .send({ refresh_token: refreshToken });
    expect(logout.status).toBe(204);

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refresh_token: refreshToken });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/forgot-password + /api/auth/reset-password', () => {
  const email = uniqueEmail('forgot');
  let userId;

  beforeAll(async () => {
    const user = await registerAndVerify({ email, nom: 'Forgot', prenom: 'Test' });
    userId = user.id;
  });

  it('forgot-password répond toujours avec un message générique', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('réinitialise le mot de passe avec un token valide', async () => {
    const { rows } = await pool.query(
      `SELECT token FROM password_reset
       WHERE id_utilisateur = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rows[0].token, mot_de_passe: 'NewPassword456' });
    expect(reset.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, mot_de_passe: 'NewPassword456' });
    expect(login.status).toBe(200);
  });

  it('retourne 400 avec un token invalide', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'invalid_token', mot_de_passe: 'NewPassword456' });

    expect(res.status).toBe(400);
  });
});

describe('MFA - activation puis login', () => {
  let token;

  beforeAll(async () => {
    const user = await registerAndVerify({ nom: 'Mfa', prenom: 'Test' });
    token = user.access_token;
  });

  it('active le MFA et exige un code TOTP au login', async () => {
    const setup = await request(app)
      .get('/api/auth/mfa/setup')
      .set('Authorization', `Bearer ${token}`);
    expect(setup.status).toBe(200);
    const secret = setup.body.secret;

    const code = speakeasy.totp({ secret, encoding: 'base32' });
    const activate = await request(app)
      .post('/api/auth/mfa/activate')
      .set('Authorization', `Bearer ${token}`)
      .send({ code });
    expect(activate.status).toBe(200);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    const { email } = me.body;

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, mot_de_passe: 'Password123' });
    expect(login.status).toBe(200);
    expect(login.body.mfa_required).toBe(true);
    expect(login.body).toHaveProperty('mfa_token');

    const verify = await request(app)
      .post('/api/auth/mfa/verify')
      .send({ mfa_token: login.body.mfa_token, code: speakeasy.totp({ secret, encoding: 'base32' }) });
    expect(verify.status).toBe(200);
    expect(verify.body).toHaveProperty('access_token');
  });
});
