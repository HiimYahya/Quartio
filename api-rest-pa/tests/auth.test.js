const request = require('supertest');
const app     = require('../src/app');

// Ces tests nécessitent que les bases de données soient accessibles (intégration)
// Lance avec: docker-compose up -d && npm test

describe('POST /api/auth/register', () => {
  const uniqueEmail = `test_${Date.now()}@test.com`;

  it('crée un compte avec des données valides', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        nom:          'Test',
        prenom:       'User',
        email:        uniqueEmail,
        mot_de_passe: 'Password123',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
    expect(res.body.utilisateur).toHaveProperty('email', uniqueEmail);
  });

  it('retourne 409 si l\'email est déjà utilisé', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        nom:          'Test',
        prenom:       'User',
        email:        uniqueEmail,
        mot_de_passe: 'Password123',
      });

    expect(res.status).toBe(409);
  });

  it('retourne 400 si le mot de passe est trop court', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        nom:          'Test',
        prenom:       'User',
        email:        `short_${Date.now()}@test.com`,
        mot_de_passe: '123',
      });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  const email    = `login_${Date.now()}@test.com`;
  const password = 'Password123';

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Login', prenom: 'Test', email, mot_de_passe: password });
  });

  it('retourne un token avec des identifiants valides', async () => {
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
  const email    = `me_${Date.now()}@test.com`;
  const password = 'Password123';

  beforeAll(async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Me', prenom: 'Test', email, mot_de_passe: password });
    token = reg.body.access_token;
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

describe('POST /api/auth/refresh', () => {
  let refreshToken;

  beforeAll(async () => {
    const email = `refresh_${Date.now()}@test.com`;
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ nom: 'Ref', prenom: 'Test', email, mot_de_passe: 'Password123' });
    refreshToken = reg.body.refresh_token;
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
});
