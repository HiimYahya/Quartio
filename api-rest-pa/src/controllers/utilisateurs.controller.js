const bcrypt    = require('bcrypt');
const speakeasy = require('speakeasy');
const pool   = require('../config/db');
const mailer = require('../config/mailer');
const { driver } = require('../config/neo4j');
const { getPagination, paginate } = require('../utils/pagination');
const { getUserQuartierIds, isPrivileged } = require('../utils/quartiers');
const Annonce = require('../models/mongo/annonce.model');

// Vérifie le code MFA si l'utilisateur l'a activé. Retourne un message d'erreur ou null.
const checkMfaIfActive = async (user, mfa_code) => {
  if (!user.mfa_actif) return null;
  if (!mfa_code) return 'Code MFA requis';
  const valid = speakeasy.totp.verify({
    secret: user.mfa_secret, encoding: 'base32', token: mfa_code, window: 1,
  });
  return valid ? null : 'Code MFA invalide';
};

// GET /api/utilisateurs  (admin)
exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { role } = req.query;

    const conditions = [];
    const values     = [];
    if (role) { conditions.push(`role = $${values.length + 1}`); values.push(role); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = (await pool.query(`SELECT COUNT(*) FROM utilisateur ${where}`, values)).rows[0].count;
    const result = await pool.query(
      `SELECT id_utilisateur, nom, prenom, email, telephone, role, points_solde, langue, date_inscription, email_verifie, suspendu_jusqu_au
       FROM utilisateur ${where} ORDER BY id_utilisateur LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, skip]
    );
    res.json(paginate(result.rows, parseInt(total), page, limit));
  } catch (err) { next(err); }
};

// GET /api/utilisateurs/voisins-fiables  (auth)
// Voisins ayant le plus de contrats finalisés avec l'utilisateur connecté ([:A_AIDE] dans les deux sens)
exports.voisinsFiables = async (req, res, next) => {
  try {
    const uid = req.user.id;
    const session = driver.session();
    let voisins = [];
    try {
      const result = await session.run(
        `MATCH (me:Utilisateur {pg_id: $uid})-[:A_AIDE]-(voisin:Utilisateur)
         WHERE voisin.pg_id <> $uid
         RETURN voisin.pg_id AS pg_id, count(*) AS score
         ORDER BY score DESC LIMIT 10`,
        { uid }
      );
      voisins = result.records.map((r) => ({
        id_utilisateur: r.get('pg_id'),
        score: r.get('score').toNumber ? r.get('score').toNumber() : r.get('score'),
      }));
    } finally {
      await session.close();
    }

    if (voisins.length === 0) return res.json([]);

    const ids = voisins.map((v) => v.id_utilisateur);
    const { rows } = await pool.query(
      `SELECT id_utilisateur, nom, prenom, points_solde FROM utilisateur WHERE id_utilisateur = ANY($1)`,
      [ids]
    );
    const byId = new Map(rows.map((r) => [r.id_utilisateur, r]));
    const data = voisins
      .map((v) => byId.has(v.id_utilisateur) ? { ...byId.get(v.id_utilisateur), score: v.score } : null)
      .filter(Boolean);

    res.json(data);
  } catch (err) { next(err); }
};

// GET /api/utilisateurs/:id  (auth)
exports.getById = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id_utilisateur, nom, prenom, email, telephone, role, points_solde, langue, date_inscription
       FROM utilisateur WHERE id_utilisateur = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

// PUT /api/utilisateurs/:id  (soi-même ou admin)
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.id !== parseInt(id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const current = await pool.query('SELECT * FROM utilisateur WHERE id_utilisateur = $1', [id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const u = current.rows[0];
    const { nom, prenom, telephone, langue } = req.body;

    const result = await pool.query(
      `UPDATE utilisateur SET nom=$1, prenom=$2, telephone=$3, langue=$4
       WHERE id_utilisateur=$5
       RETURNING id_utilisateur, nom, prenom, email, telephone, role, points_solde, langue`,
      [nom ?? u.nom, prenom ?? u.prenom, telephone ?? u.telephone, langue ?? u.langue, id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

// PUT /api/utilisateurs/:id/password  (soi-même)
exports.changePassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.id !== parseInt(id)) return res.status(403).json({ error: 'Accès refusé' });

    const { ancien_mot_de_passe, nouveau_mot_de_passe, mfa_code } = req.body;

    const { rows } = await pool.query('SELECT * FROM utilisateur WHERE id_utilisateur = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    const u = rows[0];

    const match = await bcrypt.compare(ancien_mot_de_passe, u.mot_de_passe);
    if (!match) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });

    const mfaError = await checkMfaIfActive(u, mfa_code);
    if (mfaError) return res.status(400).json({ error: mfaError });

    const hash = await bcrypt.hash(nouveau_mot_de_passe, 10);
    await pool.query('UPDATE utilisateur SET mot_de_passe = $1 WHERE id_utilisateur = $2', [hash, id]);

    // Déconnecte toutes les sessions par sécurité (l'utilisateur devra se reconnecter)
    await pool.query('UPDATE refresh_token SET est_revoque = TRUE WHERE id_utilisateur = $1', [id]);

    res.json({ message: 'Mot de passe modifié. Vous avez été déconnecté de toutes les sessions.' });
  } catch (err) { next(err); }
};

// PUT /api/utilisateurs/:id/email  (soi-même)
exports.changeEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.id !== parseInt(id)) return res.status(403).json({ error: 'Accès refusé' });

    const { nouvel_email, mfa_code } = req.body;

    const { rows } = await pool.query('SELECT * FROM utilisateur WHERE id_utilisateur = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    const u = rows[0];

    if (nouvel_email === u.email) return res.status(400).json({ error: 'Cet email est déjà le vôtre' });

    const existing = await pool.query('SELECT id_utilisateur FROM utilisateur WHERE email = $1', [nouvel_email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const mfaError = await checkMfaIfActive(u, mfa_code);
    if (mfaError) return res.status(400).json({ error: mfaError });

    await pool.query(
      'UPDATE utilisateur SET email = $1, email_verifie = FALSE WHERE id_utilisateur = $2',
      [nouvel_email, id]
    );

    // Envoie un nouveau code de vérification pour le nouvel email
    const code     = String(Math.floor(100000 + Math.random() * 900000));
    const expireAt = new Date(Date.now() + 15 * 60 * 1000);
    await pool.query(
      'INSERT INTO email_verification (id_utilisateur, code, expire_le) VALUES ($1, $2, $3)',
      [id, code, expireAt]
    );
    mailer.sendVerificationEmail(nouvel_email, u.prenom, code).catch(() => {});

    res.json({ message: 'Email modifié. Un code de vérification vous a été envoyé.', email_verification_required: true });
  } catch (err) { next(err); }
};

// PUT /api/utilisateurs/:id/telephone  (soi-même)
exports.changeTelephone = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.id !== parseInt(id)) return res.status(403).json({ error: 'Accès refusé' });

    const { telephone, mfa_code } = req.body;

    const { rows } = await pool.query('SELECT * FROM utilisateur WHERE id_utilisateur = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    const u = rows[0];

    const mfaError = await checkMfaIfActive(u, mfa_code);
    if (mfaError) return res.status(400).json({ error: mfaError });

    const result = await pool.query(
      `UPDATE utilisateur SET telephone = $1 WHERE id_utilisateur = $2
       RETURNING id_utilisateur, nom, prenom, email, telephone, role, points_solde, langue`,
      [telephone || null, id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

// GET /api/utilisateurs/:id/sessions  (soi-même)
// Liste les sessions actives (refresh tokens non révoqués et non expirés)
exports.getSessions = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.id !== parseInt(id)) return res.status(403).json({ error: 'Accès refusé' });

    const { rows } = await pool.query(
      `SELECT id, cree_le, expire_le FROM refresh_token
       WHERE id_utilisateur = $1 AND est_revoque = FALSE AND expire_le > NOW()
       ORDER BY cree_le DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// DELETE /api/utilisateurs/:id/sessions  (soi-même) - "Déconnecter partout"
exports.revokeSessions = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.id !== parseInt(id)) return res.status(403).json({ error: 'Accès refusé' });

    await pool.query('UPDATE refresh_token SET est_revoque = TRUE WHERE id_utilisateur = $1', [id]);
    res.json({ message: 'Toutes les sessions ont été déconnectées.' });
  } catch (err) { next(err); }
};

// DELETE /api/utilisateurs/:id  (admin)
exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM utilisateur WHERE id_utilisateur = $1 RETURNING id_utilisateur',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const session = driver.session();
    try {
      await session.run(
        'MATCH (u:Utilisateur {pg_id: $pg_id}) DETACH DELETE u',
        { pg_id: parseInt(id) }
      );
    } finally {
      await session.close();
    }

    res.status(204).send();
  } catch (err) { next(err); }
};

// POST /api/utilisateurs/:id/quartier  -> Neo4j [:HABITE]
exports.addQuartier = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const { id_quartier } = req.body;

    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const q = await pool.query('SELECT id_quartier FROM quartier WHERE id_quartier = $1', [id_quartier]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Quartier non trouvé' });

    const session = driver.session();
    try {
      await session.run(
        `MERGE (u:Utilisateur {pg_id: $uid})
         MERGE (q:Quartier {pg_id: $qid})
         MERGE (u)-[:HABITE]->(q)`,
        { uid: userId, qid: parseInt(id_quartier) }
      );
    } finally {
      await session.close();
    }

    res.status(201).json({ message: 'Associé au quartier avec succès' });
  } catch (err) { next(err); }
};

// DELETE /api/utilisateurs/:id/quartier/:idQ  -> Neo4j
exports.removeQuartier = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const idQ    = parseInt(req.params.idQ);

    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const session = driver.session();
    try {
      await session.run(
        `MATCH (u:Utilisateur {pg_id: $uid})-[r:HABITE]->(q:Quartier {pg_id: $qid})
         DELETE r`,
        { uid: userId, qid: idQ }
      );
    } finally {
      await session.close();
    }

    res.status(204).send();
  } catch (err) { next(err); }
};

// GET /api/utilisateurs/:id/transactions  (soi-même ou admin)
exports.getTransactions = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);

    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const session = driver.session();
    let txIds = [];
    try {
      const neo4jResult = await session.run(
        `MATCH (t:Transaction)-[:EST_POUR]->(u:Utilisateur {pg_id: $uid})
         RETURN t.pg_id AS pg_id`,
        { uid: userId }
      );
      txIds = neo4jResult.records.map((r) => r.get('pg_id'));
    } finally {
      await session.close();
    }

    if (txIds.length === 0) return res.json([]);

    const result = await pool.query(
      'SELECT * FROM transaction_points WHERE id_transaction = ANY($1::int[]) ORDER BY date DESC',
      [txIds]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

// ─── Ray casting ─────────────────────────────────────────────────────────────
// Détermine si un point (lat, lng) est à l'intérieur d'un polygone GeoJSON.
//
// Algorithme : on lance un rayon horizontal vers la droite depuis le point.
// On compte combien de fois ce rayon coupe les arêtes du polygone.
//   - Nombre impair  -> le point est DEDANS
//   - Nombre pair    -> le point est DEHORS
//
// ring : tableau de [lng, lat] (format GeoJSON - attention, ordre inversé vs Leaflet)
function pointInPolygon(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]; const yi = ring[i][1]; // [lng, lat]
    const xj = ring[j][0]; const yj = ring[j][1];
    // Le rayon croise l'arête si :
    //   - le point est entre les latitudes des deux sommets
    //   - le point est à gauche du point d'intersection
    const cross = ((yi > lat) !== (yj > lat))
      && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (cross) inside = !inside;
  }
  return inside;
}

// GET /api/utilisateurs/:id/quartiers -> récupère le/les quartier(s) de l'utilisateur
exports.getQuartiers = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const session = driver.session();
    let ids = [];
    try {
      const result = await session.run(
        'MATCH (u:Utilisateur {pg_id: $uid})-[:HABITE]->(q:Quartier) RETURN q.pg_id AS id',
        { uid: userId }
      );
      ids = result.records.map((r) => {
        const v = r.get('id');
        return typeof v === 'object' ? v.toNumber() : parseInt(v);
      });
    } finally {
      await session.close();
    }

    if (ids.length === 0) return res.json([]);

    const rows = await pool.query(
      'SELECT id_quartier, nom FROM quartier WHERE id_quartier = ANY($1::int[])',
      [ids]
    );
    res.json(rows.rows);
  } catch (err) { next(err); }
};

// POST /api/utilisateurs/:id/quartier/detect
// Body : { adresse: string }
// 1. Géocode l'adresse via Nominatim (OpenStreetMap)
// 2. Ray casting sur tous les quartiers avec une géométrie
// 3. Si trouvé : crée la relation HABITE dans Neo4j et retourne le quartier
// 4. Si non trouvé : 404 avec le message approprié
exports.detectQuartier = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const { adresse } = req.body;

    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    if (!adresse || !adresse.trim()) {
      return res.status(400).json({ error: 'Adresse requise' });
    }

    // ── Étape 1 : Géocodage Nominatim ────────────────────────────────────────
    const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(adresse.trim())}&format=json&limit=1`;
    const geoRes = await fetch(geoUrl, {
      headers: { 'User-Agent': 'Quartio/1.0 contact@quartio.fr' },
    });
    const geoData = await geoRes.json();

    if (!geoData.length) {
      return res.status(422).json({ error: 'Adresse introuvable - vérifiez votre saisie' });
    }

    const lat = parseFloat(geoData[0].lat);
    const lng = parseFloat(geoData[0].lon);

    // ── Étape 2 : Récupération des quartiers avec géométrie ───────────────────
    const { rows: quartiers } = await pool.query(
      'SELECT id_quartier, nom, geometrie FROM quartier WHERE geometrie IS NOT NULL'
    );

    // ── Étape 3 : Ray casting ─────────────────────────────────────────────────
    let found = null;
    for (const q of quartiers) {
      try {
        const ring = JSON.parse(q.geometrie).geometry.coordinates[0]; // [[lng,lat], ...]
        if (pointInPolygon(lat, lng, ring)) {
          found = q;
          break;
        }
      } catch { /* géométrie invalide - on ignore */ }
    }

    if (!found) {
      return res.status(404).json({
        error: 'Aucun quartier ne correspond à cette adresse',
        coordinates: { lat, lng },
      });
    }

    // ── Étape 4 : Assigne le quartier dans Neo4j (relation HABITE) ────────────
    const session = driver.session();
    try {
      await session.run(
        `MERGE (u:Utilisateur {pg_id: $uid})
         MERGE (q:Quartier    {pg_id: $qid})
         MERGE (u)-[:HABITE]->(q)`,
        { uid: userId, qid: found.id_quartier }
      );
    } finally {
      await session.close();
    }

    res.json({
      quartier:    { id_quartier: found.id_quartier, nom: found.nom },
      coordinates: { lat, lng },
    });
  } catch (err) { next(err); }
};

// GET /api/utilisateurs/:id/public  (auth) - profil public d'un voisin
exports.profilPublic = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const base = await pool.query(
      'SELECT id_utilisateur, nom, prenom, role, date_inscription FROM utilisateur WHERE id_utilisateur = $1',
      [userId]
    );
    if (base.rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    // Statistiques d'entraide (Neo4j [:A_AIDE])
    const session = driver.session();
    let rendus = 0, recus = 0;
    try {
      const r = await session.run(
        `MATCH (u:Utilisateur {pg_id: $id})
         OPTIONAL MATCH (u)-[out:A_AIDE]->()
         WITH u, count(out) AS rendus
         OPTIONAL MATCH (u)<-[inc:A_AIDE]-()
         RETURN rendus, count(inc) AS recus`,
        { id: userId }
      );
      if (r.records[0]) {
        const toInt = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : Number(v) || 0);
        rendus = toInt(r.records[0].get('rendus'));
        recus  = toInt(r.records[0].get('recus'));
      }
    } finally { await session.close(); }

    // Annonces actives visibles par le demandeur (cloisonnement quartier)
    const filter = { id_utilisateur_pg: userId, statut: 'active' };
    if (!isPrivileged(req.user)) {
      const qids = await getUserQuartierIds(req.user.id);
      filter.id_quartier = { $in: qids };
    }
    const annonces = await Annonce.find(filter).sort({ createdAt: -1 }).limit(10).lean();

    res.json({
      ...base.rows[0],
      services_rendus: rendus,
      services_recus:  recus,
      annonces,
    });
  } catch (err) { next(err); }
};

// PUT /api/utilisateurs/:id/suspension  (admin) - body { jours } (0/absent = réactiver)
exports.suspendre = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const jours  = Number(req.body.jours) || 0;
    const until  = jours > 0 ? new Date(Date.now() + jours * 24 * 3600 * 1000) : null;

    const { rows } = await pool.query(
      'UPDATE utilisateur SET suspendu_jusqu_au = $2 WHERE id_utilisateur = $1 RETURNING id_utilisateur, email, suspendu_jusqu_au',
      [userId, until]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    // Suspension -> révoque les sessions pour forcer la déconnexion immédiate
    if (until) {
      await pool.query('UPDATE refresh_token SET est_revoque = TRUE WHERE id_utilisateur = $1', [userId]);
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// POST /api/utilisateurs/:id/points  (admin) - crédit/débit manuel  body { montant, motif }
exports.ajusterPoints = async (req, res, next) => {
  try {
    const userId  = parseInt(req.params.id);
    const montant = parseInt(req.body.montant);
    const motif   = (req.body.motif || 'Ajustement administrateur').toString().slice(0, 200);
    if (!Number.isInteger(montant) || montant === 0) {
      return res.status(400).json({ error: 'Montant invalide (entier non nul)' });
    }

    const u = await pool.query('SELECT points_solde FROM utilisateur WHERE id_utilisateur = $1', [userId]);
    if (u.rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    if (u.rows[0].points_solde + montant < 0) {
      return res.status(400).json({ error: 'Solde insuffisant pour ce débit' });
    }

    const upd = await pool.query(
      'UPDATE utilisateur SET points_solde = points_solde + $2 WHERE id_utilisateur = $1 RETURNING id_utilisateur, points_solde',
      [userId, montant]
    );
    const tx = await pool.query(
      'INSERT INTO transaction_points (montant, motif) VALUES ($1, $2) RETURNING id_transaction',
      [montant, motif]
    );
    // Rattache la transaction à l'utilisateur (Neo4j [:EST_POUR]) pour l'historique
    const session = driver.session();
    try {
      await session.run(
        'MERGE (t:Transaction {pg_id: $tid}) MERGE (u:Utilisateur {pg_id: $uid}) MERGE (t)-[:EST_POUR]->(u)',
        { tid: tx.rows[0].id_transaction, uid: userId }
      );
    } finally { await session.close(); }

    res.json(upd.rows[0]);
  } catch (err) { next(err); }
};
