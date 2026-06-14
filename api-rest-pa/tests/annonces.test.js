const request = require('supertest');
const app     = require('../src/app');
const pool    = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

// Ces tests nécessitent que les bases de données soient accessibles (intégration)
// Lance avec: docker-compose up -d && npm test

describe('CRUD /api/annonces', () => {
  let token;
  let quartierId;
  let annonceId;

  beforeAll(async () => {
    const user = await registerAndVerify({ nom: 'Annonce', prenom: 'Test' });
    token = user.access_token;

    const { rows } = await pool.query('SELECT id_quartier FROM quartier LIMIT 1');
    quartierId = rows[0].id_quartier;
  });

  it('retourne 401 sans token à la création', async () => {
    const res = await request(app)
      .post('/api/annonces')
      .send({ titre: 'Sans auth', id_quartier: quartierId });

    expect(res.status).toBe(401);
  });

  it('retourne 400 si id_quartier manquant', async () => {
    const res = await request(app)
      .post('/api/annonces')
      .set('Authorization', `Bearer ${token}`)
      .send({ titre: 'Annonce sans quartier' });

    expect(res.status).toBe(400);
  });

  it('crée une annonce', async () => {
    const res = await request(app)
      .post('/api/annonces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        titre: 'Cours de guitare', description: 'Cours débutant', type: 'service',
        categorie: 'loisirs', est_payant: true, cout_points: 30, id_quartier: quartierId,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('_id');
    expect(res.body.titre).toBe('Cours de guitare');
    expect(res.body.statut).toBe('active');
    annonceId = res.body._id;
  });

  it('liste les annonces (paginé)', async () => {
    const res = await request(app).get('/api/annonces');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('retourne une annonce par id', async () => {
    const res = await request(app).get(`/api/annonces/${annonceId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('_id', annonceId);
  });

  it('retourne 404 pour un id inexistant', async () => {
    const res = await request(app).get('/api/annonces/000000000000000000000000');
    expect(res.status).toBe(404);
  });

  it('refuse la modification par un autre utilisateur', async () => {
    const other = await registerAndVerify({ nom: 'Autre', prenom: 'Test' });
    const res = await request(app)
      .put(`/api/annonces/${annonceId}`)
      .set('Authorization', `Bearer ${other.access_token}`)
      .send({ titre: 'Modifié par un autre' });

    expect(res.status).toBe(403);
  });

  it('modifie l\'annonce (auteur)', async () => {
    const res = await request(app)
      .put(`/api/annonces/${annonceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cout_points: 50 });

    expect(res.status).toBe(200);
    expect(res.body.cout_points).toBe(50);
  });

  it('supprime l\'annonce (auteur)', async () => {
    const res = await request(app)
      .delete(`/api/annonces/${annonceId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    const get = await request(app).get(`/api/annonces/${annonceId}`);
    expect(get.status).toBe(404);
  });
});
