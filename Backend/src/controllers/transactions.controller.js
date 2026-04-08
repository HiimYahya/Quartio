const pool       = require('../config/db');
const { driver } = require('../config/neo4j');
const { getPagination, paginate } = require('../utils/pagination');

// GET /api/transactions  → mes transactions via Neo4j [:EST_POUR]
exports.getMes = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const session = driver.session();
    let txIds = [];
    try {
      const result = await session.run(
        `MATCH (t:Transaction)-[:EST_POUR]->(u:Utilisateur {pg_id: $uid})
         RETURN t.pg_id AS pg_id`,
        { uid: req.user.id }
      );
      txIds = result.records.map((r) => r.get('pg_id').toNumber());
    } finally {
      await session.close();
    }

    if (txIds.length === 0) return res.json(paginate([], 0, page, limit));

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM transaction_points WHERE id_transaction = ANY($1::int[])',
      [txIds]
    );
    const result = await pool.query(
      'SELECT * FROM transaction_points WHERE id_transaction = ANY($1::int[]) ORDER BY date DESC LIMIT $2 OFFSET $3',
      [txIds, limit, skip]
    );
    res.json(paginate(result.rows, parseInt(countResult.rows[0].count), page, limit));
  } catch (err) { next(err); }
};

// GET /api/transactions/:id  (auth — propriétaire ou admin)
exports.getById = async (req, res, next) => {
  try {
    const txId = parseInt(req.params.id);

    const session = driver.session();
    let isOwner = false;
    try {
      const result = await session.run(
        `MATCH (t:Transaction {pg_id: $tid})-[:EST_POUR]->(u:Utilisateur {pg_id: $uid})
         RETURN t`,
        { tid: txId, uid: req.user.id }
      );
      isOwner = result.records.length > 0;
    } finally {
      await session.close();
    }

    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const result = await pool.query(
      'SELECT * FROM transaction_points WHERE id_transaction = $1',
      [txId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transaction non trouvée' });

    res.json(result.rows[0]);
  } catch (err) { next(err); }
};
