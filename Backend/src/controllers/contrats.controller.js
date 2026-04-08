const pool                   = require('../config/db');
const { driver }             = require('../config/neo4j');
const { getPagination, paginate } = require('../utils/pagination');
const { createNotification } = require('../utils/notify');

// GET /api/contrats  → mes contrats via Neo4j [:SIGNE]
exports.getMes = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const session = driver.session();
    let contratIds = [];
    try {
      const result = await session.run(
        `MATCH (u:Utilisateur {pg_id: $uid})-[:SIGNE]->(c:Contrat)
         RETURN c.pg_id AS pg_id`,
        { uid: req.user.id }
      );
      contratIds = result.records.map((r) => r.get('pg_id').toNumber());
    } finally {
      await session.close();
    }

    if (contratIds.length === 0) return res.json(paginate([], 0, page, limit));

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM contrat WHERE id_contrat = ANY($1::int[])',
      [contratIds]
    );
    const result = await pool.query(
      'SELECT * FROM contrat WHERE id_contrat = ANY($1::int[]) ORDER BY date_creation DESC LIMIT $2 OFFSET $3',
      [contratIds, limit, skip]
    );
    res.json(paginate(result.rows, parseInt(countResult.rows[0].count), page, limit));
  } catch (err) { next(err); }
};

// GET /api/contrats/:id  (auth — participant ou admin)
exports.getById = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM contrat WHERE id_contrat = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contrat non trouvé' });

    // Vérifier que l'utilisateur est signataire ou admin
    const session = driver.session();
    let isSigne = false;
    try {
      const neo = await session.run(
        `MATCH (u:Utilisateur {pg_id: $uid})-[:SIGNE]->(c:Contrat {pg_id: $cid})
         RETURN u`,
        { uid: req.user.id, cid: parseInt(req.params.id) }
      );
      isSigne = neo.records.length > 0;
    } finally {
      await session.close();
    }

    if (!isSigne && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

// POST /api/contrats  (auth)
exports.create = async (req, res, next) => {
  try {
    const { points_echanges, id_annonce_mongo } = req.body;

    const result = await pool.query(
      `INSERT INTO contrat (points_echanges) VALUES ($1) RETURNING *`,
      [points_echanges ?? 0]
    );
    const contrat = result.rows[0];

    const session = driver.session();
    try {
      await session.run(
        `MERGE (c:Contrat {pg_id: $cid})
         MERGE (u:Utilisateur {pg_id: $uid})
         MERGE (u)-[:SIGNE]->(c)`,
        { cid: contrat.id_contrat, uid: req.user.id }
      );

      if (id_annonce_mongo) {
        await session.run(
          `MERGE (a:Annonce {mongo_id: $mid})
           MERGE (c:Contrat {pg_id: $cid})
           MERGE (a)-[:GENERE]->(c)`,
          { mid: id_annonce_mongo, cid: contrat.id_contrat }
        );
      }
    } finally {
      await session.close();
    }

    res.status(201).json(contrat);
  } catch (err) { next(err); }
};

// PUT /api/contrats/:id/signer  → Neo4j [:SIGNE] + transaction de points
exports.signer = async (req, res, next) => {
  try {
    const contratId = parseInt(req.params.id);

    const contrat = await pool.query('SELECT * FROM contrat WHERE id_contrat = $1', [contratId]);
    if (contrat.rows.length === 0) return res.status(404).json({ error: 'Contrat non trouvé' });

    if (contrat.rows[0].statut !== 'en_attente') {
      return res.status(409).json({ error: 'Ce contrat ne peut plus être signé' });
    }

    // Vérifier que l'utilisateur a assez de points si points_echanges > 0
    const points = contrat.rows[0].points_echanges;
    if (points > 0) {
      const user = await pool.query('SELECT points_solde FROM utilisateur WHERE id_utilisateur = $1', [req.user.id]);
      if (user.rows[0].points_solde < points) {
        return res.status(409).json({ error: 'Points insuffisants' });
      }
    }

    // Mettre à jour le contrat
    const updated = await pool.query(
      `UPDATE contrat SET statut='signe', date_signature=NOW()
       WHERE id_contrat=$1 RETURNING *`,
      [contratId]
    );

    // Déduire les points si nécessaire
    if (points > 0) {
      await pool.query(
        'UPDATE utilisateur SET points_solde = points_solde - $1 WHERE id_utilisateur = $2',
        [points, req.user.id]
      );

      // Créer la transaction de points
      const tx = await pool.query(
        `INSERT INTO transaction_points (montant, motif) VALUES ($1, $2) RETURNING *`,
        [-points, `Signature contrat #${contratId}`]
      );

      // Relations Neo4j
      const session = driver.session();
      try {
        await session.run(
          `MERGE (u:Utilisateur {pg_id: $uid})-[:SIGNE]->(c:Contrat {pg_id: $cid})
           MERGE (t:Transaction {pg_id: $tid})
           MERGE (c)-[:LIE_A]->(t)
           MERGE (t)-[:EST_POUR]->(u)`,
          { uid: req.user.id, cid: contratId, tid: tx.rows[0].id_transaction }
        );
      } finally {
        await session.close();
      }
    } else {
      const session = driver.session();
      try {
        await session.run(
          `MERGE (u:Utilisateur {pg_id: $uid})
           MERGE (c:Contrat {pg_id: $cid})
           MERGE (u)-[:SIGNE]->(c)`,
          { uid: req.user.id, cid: contratId }
        );
      } finally {
        await session.close();
      }
    }

    // Notifier le créateur du contrat (si différent du signataire)
    createNotification(
      req.user.id,
      'contrat',
      'Contrat signé',
      `Le contrat #${contratId} a été signé avec succès`,
      String(contratId),
      'contrat'
    );

    res.json(updated.rows[0]);
  } catch (err) { next(err); }
};

// PUT /api/contrats/:id/statut  (admin)
exports.updateStatut = async (req, res, next) => {
  try {
    const { statut } = req.body;
    const result = await pool.query(
      'UPDATE contrat SET statut=$1 WHERE id_contrat=$2 RETURNING *',
      [statut, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contrat non trouvé' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};
