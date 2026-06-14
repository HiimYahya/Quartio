const request = require('supertest');
const app     = require('../src/app');
const { registerAndVerify } = require('./helpers');

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
    const admin = await registerAndVerify({ nom: 'Admin', prenom: 'Test', role: 'admin' });
    adminToken = admin.access_token;
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

describe('Détection de chevauchement de zones (Turf.js)', () => {
  let adminToken;
  let quartierAId;
  let quartierCId;

  const geoA = JSON.stringify({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[100, 0], [101, 0], [101, 1], [100, 1], [100, 0]]] },
  });
  const geoBOverlap = JSON.stringify({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[100.5, 0.5], [101.5, 0.5], [101.5, 1.5], [100.5, 1.5], [100.5, 0.5]]] },
  });
  const geoC = JSON.stringify({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[110, 10], [111, 10], [111, 11], [110, 11], [110, 10]]] },
  });

  beforeAll(async () => {
    const admin = await registerAndVerify({ nom: 'AdminGeo', prenom: 'Test', role: 'admin' });
    adminToken = admin.access_token;

    const resA = await request(app)
      .post('/api/quartiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: `QuartierA_${Date.now()}`, geometrie: geoA });
    quartierAId = resA.body.id_quartier;
  });

  afterAll(async () => {
    // Nettoyage : ces quartiers ont une géométrie fixe, on les supprime pour
    // ne pas fausser la détection de chevauchement des prochaines exécutions.
    for (const id of [quartierAId, quartierCId]) {
      if (id) {
        await request(app).delete(`/api/quartiers/${id}`).set('Authorization', `Bearer ${adminToken}`);
      }
    }
  });

  it('crée un quartier avec une géométrie', async () => {
    expect(quartierAId).toBeDefined();
  });

  it('refuse une zone qui chevauche un quartier existant', async () => {
    const res = await request(app)
      .post('/api/quartiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: `QuartierB_${Date.now()}`, geometrie: geoBOverlap });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/chevauche/);
  });

  it('accepte une zone qui ne chevauche aucun quartier', async () => {
    const res = await request(app)
      .post('/api/quartiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: `QuartierC_${Date.now()}`, geometrie: geoC });

    expect(res.status).toBe(201);
    quartierCId = res.body.id_quartier;
  });

  it('refuse la modification d\'un quartier si la nouvelle géométrie chevauche un autre', async () => {
    const res = await request(app)
      .put(`/api/quartiers/${quartierCId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ geometrie: geoBOverlap });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/chevauche/);
  });

  it('autorise la modification d\'un quartier en gardant sa propre géométrie (pas d\'auto-conflit)', async () => {
    const res = await request(app)
      .put(`/api/quartiers/${quartierAId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: `QuartierA_renomme_${Date.now()}`, geometrie: geoA });

    expect(res.status).toBe(200);
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
