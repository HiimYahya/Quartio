const request = require('supertest');
const app     = require('../src/app');

describe('GET /api/quartiers', () => {
  it('retourne une liste paginée de quartiers', async () => {
    const res = await request(app).get('/api/quartiers');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toHaveProperty('page');
    expect(res.body.pagination).toHaveProperty('limit');
    expect(res.body.pagination).toHaveProperty('total');
    expect(res.body.pagination).toHaveProperty('pages');
  });

  it('respecte les paramètres de pagination', async () => {
    const res = await request(app).get('/api/quartiers?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });
});

describe('POST /api/quartiers (admin)', () => {
  let adminToken;

  beforeAll(async () => {
    // Connexion avec le compte admin du seed
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', mot_de_passe: 'password123' });
    adminToken = res.body.access_token;
  });

  it('crée un quartier (admin)', async () => {
    const res = await request(app)
      .post('/api/quartiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: `Quartier_Test_${Date.now()}` });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id_quartier');
    expect(res.body).toHaveProperty('nom');
  });

  it('retourne 401 sans token', async () => {
    const res = await request(app)
      .post('/api/quartiers')
      .send({ nom: 'Quartier sans auth' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/quartiers/:id', () => {
  let quartierId;

  beforeAll(async () => {
    const res = await request(app).get('/api/quartiers?limit=1');
    if (res.body.data.length > 0) {
      quartierId = res.body.data[0].id_quartier;
    }
  });

  it('retourne un quartier par id', async () => {
    if (!quartierId) return;
    const res = await request(app).get(`/api/quartiers/${quartierId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id_quartier', quartierId);
  });

  it('retourne 404 pour un id inexistant', async () => {
    const res = await request(app).get('/api/quartiers/999999');
    expect(res.status).toBe(404);
  });
});
