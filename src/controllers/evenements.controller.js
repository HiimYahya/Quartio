const pool            = require('../config/db');
const { driver }      = require('../config/neo4j');
const Evenement       = require('../models/mongo/evenement.model');
const validateMongoId = require('../utils/validateMongoId');
const { getPagination, paginate } = require('../utils/pagination');
const { createNotification }      = require('../utils/notify');

// GET /api/evenements?page=1&limit=20&statut=planifie&date_debut_from=...&date_debut_to=...
exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { statut, date_debut_from, date_debut_to } = req.query;

    const filter = {};
    if (statut) filter.statut = statut;
    if (date_debut_from || date_debut_to) {
      filter.date_debut = {};
      if (date_debut_from) filter.date_debut.$gte = new Date(date_debut_from);
      if (date_debut_to)   filter.date_debut.$lte = new Date(date_debut_to);
    }

    const [data, total] = await Promise.all([
      Evenement.find(filter).sort({ date_debut: 1 }).skip(skip).limit(limit),
      Evenement.countDocuments(filter),
    ]);

    res.json(paginate(data, total, page, limit));
  } catch (err) { next(err); }
};

// GET /api/evenements/:id
exports.getById = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const evenement = await Evenement.findById(req.params.id);
    if (!evenement) return res.status(404).json({ error: 'Événement non trouvé' });
    res.json(evenement);
  } catch (err) { next(err); }
};

// POST /api/evenements  (auth)
exports.create = async (req, res, next) => {
  try {
    const { titre, description, type, date_debut, date_fin, lieu, capacite_max, id_quartier } = req.body;

    const evenement = await Evenement.create({
      titre, description, type, date_debut, date_fin, lieu, capacite_max,
      id_utilisateur_pg: req.user.id,
    });

    const session = driver.session();
    try {
      await session.run(
        `MERGE (e:Evenement {mongo_id: $mid})
         MERGE (q:Quartier {pg_id: $qid})
         MERGE (u:Utilisateur {pg_id: $uid})
         MERGE (e)-[:TIENT_DANS]->(q)
         MERGE (u)-[:ORGANISE]->(e)`,
        { mid: evenement._id.toString(), qid: parseInt(id_quartier), uid: req.user.id }
      );
    } finally {
      await session.close();
    }

    res.status(201).json(evenement);
  } catch (err) { next(err); }
};

// PUT /api/evenements/:id  (organisateur ou admin)
exports.update = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const evenement = await Evenement.findById(req.params.id);
    if (!evenement) return res.status(404).json({ error: 'Événement non trouvé' });

    if (evenement.id_utilisateur_pg !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const updated = await Evenement.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json(updated);
  } catch (err) { next(err); }
};

// DELETE /api/evenements/:id  (admin)
exports.remove = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const evenement = await Evenement.findById(req.params.id);
    if (!evenement) return res.status(404).json({ error: 'Événement non trouvé' });

    await evenement.deleteOne();

    const session = driver.session();
    try {
      await session.run('MATCH (e:Evenement {mongo_id: $mid}) DETACH DELETE e', { mid: req.params.id });
    } finally {
      await session.close();
    }

    res.status(204).send();
  } catch (err) { next(err); }
};

// POST /api/evenements/:id/participer  → Neo4j [:PARTICIPE]
exports.participer = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const mid = req.params.id;

    const evenement = await Evenement.findById(mid);
    if (!evenement) return res.status(404).json({ error: 'Événement non trouvé' });

    if (evenement.capacite_max) {
      const session = driver.session();
      let count = 0;
      try {
        const result = await session.run(
          `MATCH (u:Utilisateur)-[:PARTICIPE]->(e:Evenement {mongo_id: $mid}) RETURN count(u) AS nb`,
          { mid }
        );
        count = result.records[0].get('nb').toNumber();
      } finally {
        await session.close();
      }
      if (count >= evenement.capacite_max) {
        return res.status(409).json({ error: 'Capacité maximale atteinte' });
      }
    }

    const session = driver.session();
    try {
      await session.run(
        `MERGE (u:Utilisateur {pg_id: $uid})
         MERGE (e:Evenement {mongo_id: $mid})
         MERGE (u)-[r:PARTICIPE]->(e)
         ON CREATE SET r.statut_participation = 'inscrit', r.date_action = datetime()`,
        { uid: req.user.id, mid }
      );
    } finally {
      await session.close();
    }

    // Notifier l'organisateur
    createNotification(
      evenement.id_utilisateur_pg,
      'evenement',
      'Nouvelle inscription',
      `Un utilisateur s'est inscrit à votre événement "${evenement.titre}"`,
      mid,
      'evenement'
    );

    res.status(201).json({ message: 'Inscription confirmée' });
  } catch (err) { next(err); }
};

// DELETE /api/evenements/:id/participer
exports.seDesinscrire = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const session = driver.session();
    try {
      await session.run(
        `MATCH (u:Utilisateur {pg_id: $uid})-[r:PARTICIPE]->(e:Evenement {mongo_id: $mid}) DELETE r`,
        { uid: req.user.id, mid: req.params.id }
      );
    } finally {
      await session.close();
    }
    res.status(204).send();
  } catch (err) { next(err); }
};

// GET /api/evenements/:id/participants  → Neo4j → PostgreSQL
exports.getParticipants = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;

    const session = driver.session();
    let participants = [];
    try {
      const result = await session.run(
        `MATCH (u:Utilisateur)-[r:PARTICIPE]->(e:Evenement {mongo_id: $mid})
         RETURN u.pg_id AS pg_id, r.statut_participation AS statut`,
        { mid: req.params.id }
      );
      participants = result.records.map((r) => ({
        pg_id:  r.get('pg_id').toNumber(),
        statut: r.get('statut'),
      }));
    } finally {
      await session.close();
    }

    if (participants.length === 0) return res.json([]);

    const pgIds = participants.map((p) => p.pg_id);
    const users = await pool.query(
      `SELECT id_utilisateur, nom, prenom, email FROM utilisateur WHERE id_utilisateur = ANY($1::int[])`,
      [pgIds]
    );

    res.json(users.rows.map((u) => ({
      ...u,
      statut: participants.find((p) => p.pg_id === u.id_utilisateur)?.statut,
    })));
  } catch (err) { next(err); }
};
