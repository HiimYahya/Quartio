const pool = require('../config/db');
const { driver } = require('../config/neo4j');
const { getPagination, paginate } = require('../utils/pagination');

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
      `SELECT id_utilisateur, nom, prenom, email, telephone, role, points_solde, langue, date_inscription
       FROM utilisateur ${where} ORDER BY id_utilisateur LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, skip]
    );
    res.json(paginate(result.rows, parseInt(total), page, limit));
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

// POST /api/utilisateurs/:id/quartier  → Neo4j [:HABITE]
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

// DELETE /api/utilisateurs/:id/quartier/:idQ  → Neo4j
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
      txIds = neo4jResult.records.map((r) => r.get('pg_id').toNumber());
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
