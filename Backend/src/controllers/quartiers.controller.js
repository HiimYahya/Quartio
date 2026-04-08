const pool = require('../config/db');
const { driver } = require('../config/neo4j');
const { getPagination, paginate } = require('../utils/pagination');

// GET /api/quartiers
exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const total  = (await pool.query('SELECT COUNT(*) FROM quartier')).rows[0].count;
    const result = await pool.query(
      'SELECT * FROM quartier ORDER BY id_quartier LIMIT $1 OFFSET $2',
      [limit, skip]
    );
    res.json(paginate(result.rows, parseInt(total), page, limit));
  } catch (err) {
    next(err);
  }
};

// GET /api/quartiers/:id
exports.getById = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM quartier WHERE id_quartier = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quartier non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// POST /api/quartiers  (admin)
exports.create = async (req, res, next) => {
  try {
    const { nom, geometrie } = req.body;

    const result = await pool.query(
      'INSERT INTO quartier (nom, geometrie) VALUES ($1, $2) RETURNING *',
      [nom, geometrie || null]
    );

    const quartier = result.rows[0];

    // Créer le nœud dans Neo4j
    const session = driver.session();
    try {
      await session.run(
        'MERGE (q:Quartier {pg_id: $pg_id}) SET q.nom = $nom',
        { pg_id: quartier.id_quartier, nom: quartier.nom }
      );
    } finally {
      await session.close();
    }

    res.status(201).json(quartier);
  } catch (err) {
    next(err);
  }
};

// PUT /api/quartiers/:id  (admin)
exports.update = async (req, res, next) => {
  try {
    const { nom, geometrie } = req.body;
    const { id } = req.params;

    const current = await pool.query(
      'SELECT * FROM quartier WHERE id_quartier = $1',
      [id]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Quartier non trouvé' });
    }

    const updated = {
      nom:       nom       ?? current.rows[0].nom,
      geometrie: geometrie ?? current.rows[0].geometrie,
    };

    const result = await pool.query(
      `UPDATE quartier SET nom = $1, geometrie = $2
       WHERE id_quartier = $3 RETURNING *`,
      [updated.nom, updated.geometrie, id]
    );

    // Mettre à jour le nom dans Neo4j
    const session = driver.session();
    try {
      await session.run(
        'MATCH (q:Quartier {pg_id: $pg_id}) SET q.nom = $nom',
        { pg_id: parseInt(id), nom: updated.nom }
      );
    } finally {
      await session.close();
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/quartiers/:id  (admin)
exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM quartier WHERE id_quartier = $1 RETURNING id_quartier',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quartier non trouvé' });
    }

    // Supprimer le nœud et toutes ses relations dans Neo4j
    const session = driver.session();
    try {
      await session.run(
        'MATCH (q:Quartier {pg_id: $pg_id}) DETACH DELETE q',
        { pg_id: parseInt(id) }
      );
    } finally {
      await session.close();
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// GET /api/quartiers/:id/habitants  (auth) — via Neo4j
exports.getHabitants = async (req, res, next) => {
  try {
    const { id } = req.params;

    const session = driver.session();
    let pgIds = [];
    try {
      const neo4jResult = await session.run(
        `MATCH (u:Utilisateur)-[:HABITE]->(q:Quartier {pg_id: $pg_id})
         RETURN u.pg_id AS pg_id`,
        { pg_id: parseInt(id) }
      );
      pgIds = neo4jResult.records.map((r) => r.get('pg_id').toNumber());
    } finally {
      await session.close();
    }

    if (pgIds.length === 0) return res.json([]);

    const result = await pool.query(
      `SELECT id_utilisateur, nom, prenom, email, role
       FROM utilisateur
       WHERE id_utilisateur = ANY($1::int[])`,
      [pgIds]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/quartiers/:id/annonces  — via Neo4j → MongoDB
exports.getAnnonces = async (req, res, next) => {
  try {
    const { id } = req.params;
    const Annonce = require('../models/mongo/annonce.model');

    const session = driver.session();
    let mongoIds = [];
    try {
      const neo4jResult = await session.run(
        `MATCH (a:Annonce)-[:APPARTIENT]->(q:Quartier {pg_id: $pg_id})
         RETURN a.mongo_id AS mongo_id`,
        { pg_id: parseInt(id) }
      );
      mongoIds = neo4jResult.records.map((r) => r.get('mongo_id'));
    } finally {
      await session.close();
    }

    if (mongoIds.length === 0) return res.json([]);

    const annonces = await Annonce.find({ _id: { $in: mongoIds } });
    res.json(annonces);
  } catch (err) {
    next(err);
  }
};

// GET /api/quartiers/:id/evenements  — via Neo4j → MongoDB
exports.getEvenements = async (req, res, next) => {
  try {
    const { id } = req.params;
    const Evenement = require('../models/mongo/evenement.model');

    const session = driver.session();
    let mongoIds = [];
    try {
      const neo4jResult = await session.run(
        `MATCH (e:Evenement)-[:TIENT_DANS]->(q:Quartier {pg_id: $pg_id})
         RETURN e.mongo_id AS mongo_id`,
        { pg_id: parseInt(id) }
      );
      mongoIds = neo4jResult.records.map((r) => r.get('mongo_id'));
    } finally {
      await session.close();
    }

    if (mongoIds.length === 0) return res.json([]);

    const evenements = await Evenement.find({ _id: { $in: mongoIds } });
    res.json(evenements);
  } catch (err) {
    next(err);
  }
};
