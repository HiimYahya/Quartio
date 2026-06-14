const request = require('supertest');
const app     = require('../src/app');
const { registerAndVerify } = require('./helpers');

// Ces tests nécessitent que les bases de données soient accessibles (intégration)
// Lance avec: docker-compose up -d && npm test
//
// L'appel à Nominatim (géocodage) est mocké via global.fetch pour rendre les
// tests déterministes et indépendants du réseau.

describe('Détection de quartier par adresse (ray casting)', () => {
  let user;
  let adminToken;
  let quartierId;
  let fetchSpy;

  const geo = JSON.stringify({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[150, 10], [152, 10], [152, 12], [150, 12], [150, 10]]] },
  });

  const mockGeocode = (lat, lon) => {
    fetchSpy.mockResolvedValue({
      json: async () => (lat === null ? [] : [{ lat: String(lat), lon: String(lon) }]),
    });
  };

  beforeAll(async () => {
    user = await registerAndVerify({ nom: 'RayCast', prenom: 'Test' });

    const admin = await registerAndVerify({ nom: 'AdminRay', prenom: 'Test', role: 'admin' });
    const resQ = await request(app)
      .post('/api/quartiers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ nom: `QuartierRay_${Date.now()}`, geometrie: geo });
    quartierId = resQ.body.id_quartier;
    adminToken = admin.access_token;
  });

  afterAll(async () => {
    // Nettoyage : géométrie fixe, à supprimer pour ne pas fausser les
    // prochaines exécutions (chevauchement / ray casting).
    if (quartierId) {
      await request(app).delete(`/api/quartiers/${quartierId}`).set('Authorization', `Bearer ${adminToken}`);
    }
  });

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('retourne 400 si adresse manquante', async () => {
    const res = await request(app)
      .post(`/api/utilisateurs/${user.id}/quartier/detect`)
      .set('Authorization', `Bearer ${user.access_token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('retourne 403 si un autre utilisateur non-admin tente la détection', async () => {
    const other = await registerAndVerify({ nom: 'Autre', prenom: 'RayCast' });
    const res = await request(app)
      .post(`/api/utilisateurs/${user.id}/quartier/detect`)
      .set('Authorization', `Bearer ${other.access_token}`)
      .send({ adresse: 'Quelque part' });

    expect(res.status).toBe(403);
  });

  it('retourne 422 si l\'adresse est introuvable (Nominatim vide)', async () => {
    mockGeocode(null);

    const res = await request(app)
      .post(`/api/utilisateurs/${user.id}/quartier/detect`)
      .set('Authorization', `Bearer ${user.access_token}`)
      .send({ adresse: 'Adresse inexistante zzz' });

    expect(res.status).toBe(422);
  });

  it('retourne 404 si le point géocodé ne tombe dans aucun quartier', async () => {
    mockGeocode(0, 0); // hors de tout polygone connu

    const res = await request(app)
      .post(`/api/utilisateurs/${user.id}/quartier/detect`)
      .set('Authorization', `Bearer ${user.access_token}`)
      .send({ adresse: 'Milieu de nulle part' });

    expect(res.status).toBe(404);
    expect(res.body.coordinates).toEqual({ lat: 0, lng: 0 });
  });

  it('détecte le quartier correspondant via ray casting et crée la relation HABITE', async () => {
    mockGeocode(11, 151); // à l'intérieur du polygone du quartier de test

    const res = await request(app)
      .post(`/api/utilisateurs/${user.id}/quartier/detect`)
      .set('Authorization', `Bearer ${user.access_token}`)
      .send({ adresse: 'Adresse dans le quartier de test' });

    expect(res.status).toBe(200);
    expect(res.body.quartier.id_quartier).toBe(quartierId);

    const quartiers = await request(app)
      .get(`/api/utilisateurs/${user.id}/quartiers`)
      .set('Authorization', `Bearer ${user.access_token}`);

    expect(quartiers.body.some((q) => q.id_quartier === quartierId)).toBe(true);
  });

  it('un admin peut détecter le quartier pour un autre utilisateur', async () => {
    mockGeocode(11, 151);

    const res = await request(app)
      .post(`/api/utilisateurs/${user.id}/quartier/detect`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ adresse: 'Adresse dans le quartier de test' });

    expect(res.status).toBe(200);
    expect(res.body.quartier.id_quartier).toBe(quartierId);
  });
});
