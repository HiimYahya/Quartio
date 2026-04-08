const pool            = require('../config/db');
const { driver }      = require('../config/neo4j');
const Annonce         = require('../models/mongo/annonce.model');
const validateMongoId = require('../utils/validateMongoId');
const { getPagination, paginate } = require('../utils/pagination');

// GET /api/annonces?page=1&limit=20&statut=active&categorie=...&type=...
exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { statut, categorie, type } = req.query;

    const filter = {};
    if (statut)    filter.statut    = statut;
    if (categorie) filter.categorie = new RegExp(categorie, 'i');
    if (type)      filter.type      = new RegExp(type, 'i');

    const [data, total] = await Promise.all([
      Annonce.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Annonce.countDocuments(filter),
    ]);

    res.json(paginate(data, total, page, limit));
  } catch (err) { next(err); }
};

// GET /api/annonces/:id
exports.getById = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const annonce = await Annonce.findById(req.params.id);
    if (!annonce) return res.status(404).json({ error: 'Annonce non trouvée' });
    res.json(annonce);
  } catch (err) { next(err); }
};

// POST /api/annonces  (auth)
exports.create = async (req, res, next) => {
  try {
    const { titre, description, type, est_payant, cout_points, categorie, type_concerne, id_quartier } = req.body;

    const annonce = await Annonce.create({
      titre, description, type, est_payant, cout_points, categorie, type_concerne,
      id_utilisateur_pg: req.user.id,
    });

    const session = driver.session();
    try {
      await session.run(
        `MERGE (a:Annonce {mongo_id: $mid})
         MERGE (q:Quartier {pg_id: $qid})
         MERGE (u:Utilisateur {pg_id: $uid})
         MERGE (a)-[:APPARTIENT]->(q)`,
        { mid: annonce._id.toString(), qid: parseInt(id_quartier), uid: req.user.id }
      );
    } finally {
      await session.close();
    }

    res.status(201).json(annonce);
  } catch (err) { next(err); }
};

// PUT /api/annonces/:id  (auteur ou admin)
exports.update = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const annonce = await Annonce.findById(req.params.id);
    if (!annonce) return res.status(404).json({ error: 'Annonce non trouvée' });

    if (annonce.id_utilisateur_pg !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const updated = await Annonce.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json(updated);
  } catch (err) { next(err); }
};

// DELETE /api/annonces/:id  (auteur ou admin)
exports.remove = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const annonce = await Annonce.findById(req.params.id);
    if (!annonce) return res.status(404).json({ error: 'Annonce non trouvée' });

    if (annonce.id_utilisateur_pg !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    await annonce.deleteOne();

    const session = driver.session();
    try {
      await session.run('MATCH (a:Annonce {mongo_id: $mid}) DETACH DELETE a', { mid: req.params.id });
    } finally {
      await session.close();
    }

    res.status(204).send();
  } catch (err) { next(err); }
};

// GET /api/annonces/:id/contrat  → Neo4j [:GENERE] → PostgreSQL
exports.getContrat = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;

    const session = driver.session();
    let contratId = null;
    try {
      const result = await session.run(
        `MATCH (a:Annonce {mongo_id: $mid})-[:GENERE]->(c:Contrat) RETURN c.pg_id AS pg_id`,
        { mid: req.params.id }
      );
      if (result.records.length > 0) contratId = result.records[0].get('pg_id').toNumber();
    } finally {
      await session.close();
    }

    if (!contratId) return res.status(404).json({ error: 'Aucun contrat lié à cette annonce' });

    const result = await pool.query('SELECT * FROM contrat WHERE id_contrat = $1', [contratId]);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};
