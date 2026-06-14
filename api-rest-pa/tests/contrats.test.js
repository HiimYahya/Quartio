const request = require('supertest');
const app     = require('../src/app');
const pool    = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

// Ces tests nécessitent que les bases de données soient accessibles (intégration)
// Lance avec: docker-compose up -d && npm test

describe('Flux contrat : annonce -> contrat -> signature -> finalisation', () => {
  let vendeur, acheteur;
  let quartierId, annonceId, contratId;
  const COUT = 50;

  beforeAll(async () => {
    vendeur  = await registerAndVerify({ nom: 'Vendeur',  prenom: 'Test' });
    acheteur = await registerAndVerify({ nom: 'Acheteur', prenom: 'Test' });

    const { rows } = await pool.query('SELECT id_quartier FROM quartier LIMIT 1');
    quartierId = rows[0].id_quartier;

    const annonce = await request(app)
      .post('/api/annonces')
      .set('Authorization', `Bearer ${vendeur.access_token}`)
      .send({
        titre: 'Service payant de test', type: 'service', categorie: 'bricolage',
        est_payant: true, cout_points: COUT, id_quartier: quartierId,
      });
    annonceId = annonce.body._id;
  });

  it('crée un contrat depuis l\'annonce (acheteur)', async () => {
    const res = await request(app)
      .post(`/api/annonces/${annonceId}/contrat`)
      .set('Authorization', `Bearer ${acheteur.access_token}`);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id_contrat');
    expect(res.body.points_echanges).toBe(COUT);
    expect(res.body.id_vendeur).toBe(vendeur.id);
    expect(res.body.id_acheteur).toBe(acheteur.id);
    contratId = res.body.id_contrat;
  });

  it('refuse un second contrat pour la même annonce/acheteur', async () => {
    const res = await request(app)
      .post(`/api/annonces/${annonceId}/contrat`)
      .set('Authorization', `Bearer ${acheteur.access_token}`);

    expect(res.status).toBe(409);
  });

  it('le vendeur ne peut pas accepter sa propre annonce', async () => {
    const res = await request(app)
      .post(`/api/annonces/${annonceId}/contrat`)
      .set('Authorization', `Bearer ${vendeur.access_token}`);

    expect(res.status).toBe(409);
  });

  it('apparaît dans "mes contrats" pour les deux parties', async () => {
    const resV = await request(app).get('/api/contrats').set('Authorization', `Bearer ${vendeur.access_token}`);
    const resA = await request(app).get('/api/contrats').set('Authorization', `Bearer ${acheteur.access_token}`);

    expect(resV.body.data.some((c) => c.id_contrat === contratId)).toBe(true);
    expect(resA.body.data.some((c) => c.id_contrat === contratId)).toBe(true);
  });

  it('refuse la signature d\'un tiers non participant', async () => {
    const tiers = await registerAndVerify({ nom: 'Tiers', prenom: 'Test' });
    const res = await request(app)
      .put(`/api/contrats/${contratId}/signer`)
      .set('Authorization', `Bearer ${tiers.access_token}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('l\'acheteur signe : statut passe à "signe"', async () => {
    const res = await request(app)
      .put(`/api/contrats/${contratId}/signer`)
      .set('Authorization', `Bearer ${acheteur.access_token}`)
      .send({ signature_dataurl: 'data:image/png;base64,iVBORw0KGgo=' });

    expect(res.status).toBe(200);
    expect(res.body.signe_acheteur).toBe(true);
    expect(res.body.signe_vendeur).toBe(false);
    expect(res.body.statut).toBe('signe');
  });

  it('l\'acheteur ne peut pas signer deux fois', async () => {
    const res = await request(app)
      .put(`/api/contrats/${contratId}/signer`)
      .set('Authorization', `Bearer ${acheteur.access_token}`)
      .send({});

    expect(res.status).toBe(409);
  });

  it('le vendeur signe : finalisation + transfert de points', async () => {
    const res = await request(app)
      .put(`/api/contrats/${contratId}/signer`)
      .set('Authorization', `Bearer ${vendeur.access_token}`)
      .send({ signature_dataurl: 'data:image/png;base64,iVBORw0KGgo=' });

    expect(res.status).toBe(200);
    expect(res.body.signe_vendeur).toBe(true);
    expect(res.body.statut).toBe('termine');

    const meVendeur  = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${vendeur.access_token}`);
    const meAcheteur = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${acheteur.access_token}`);

    // Les deux comptes démarrent avec 100 points de bienvenue
    expect(meVendeur.body.points_solde).toBe(100 + COUT);
    expect(meAcheteur.body.points_solde).toBe(100 - COUT);
  });

  it('l\'annonce liée est archivée après finalisation', async () => {
    const res = await request(app).get(`/api/annonces/${annonceId}`);
    expect(res.body.statut).toBe('archivee');
  });

  it('le document archivé contient les deux signatures', async () => {
    const res = await request(app)
      .get(`/api/contrats/${contratId}/document`)
      .set('Authorization', `Bearer ${acheteur.access_token}`);

    expect(res.status).toBe(200);
    expect(res.body.signatures).toHaveLength(2);
  });

  it('un contrat déjà finalisé ne peut plus être signé', async () => {
    const res = await request(app)
      .put(`/api/contrats/${contratId}/signer`)
      .set('Authorization', `Bearer ${vendeur.access_token}`)
      .send({});

    expect(res.status).toBe(409);
  });
});

describe('Contrat avec service gratuit (points_echanges = 0)', () => {
  let vendeur, acheteur, annonceId, contratId, quartierId;

  beforeAll(async () => {
    vendeur  = await registerAndVerify({ nom: 'VendeurGratuit',  prenom: 'Test' });
    acheteur = await registerAndVerify({ nom: 'AcheteurGratuit', prenom: 'Test' });

    const { rows } = await pool.query('SELECT id_quartier FROM quartier LIMIT 1');
    quartierId = rows[0].id_quartier;

    const annonce = await request(app)
      .post('/api/annonces')
      .set('Authorization', `Bearer ${vendeur.access_token}`)
      .send({ titre: 'Service gratuit de test', est_payant: false, cout_points: 0, id_quartier: quartierId });
    annonceId = annonce.body._id;

    const contrat = await request(app)
      .post(`/api/annonces/${annonceId}/contrat`)
      .set('Authorization', `Bearer ${acheteur.access_token}`);
    contratId = contrat.body.id_contrat;
  });

  it('finalisation sans transfert de points', async () => {
    await request(app)
      .put(`/api/contrats/${contratId}/signer`)
      .set('Authorization', `Bearer ${acheteur.access_token}`)
      .send({});

    const res = await request(app)
      .put(`/api/contrats/${contratId}/signer`)
      .set('Authorization', `Bearer ${vendeur.access_token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('termine');

    const meVendeur = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${vendeur.access_token}`);
    expect(meVendeur.body.points_solde).toBe(100);
  });
});
