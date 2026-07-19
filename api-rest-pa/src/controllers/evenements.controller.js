const pool            = require('../config/db');
const { driver }      = require('../config/neo4j');
const Evenement       = require('../models/mongo/evenement.model');
const validateMongoId = require('../utils/validateMongoId');
const { getPagination, paginate } = require('../utils/pagination');
const { createNotification }      = require('../utils/notify');
const { getUserQuartierIds, isPrivileged } = require('../utils/quartiers');

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

    if (!isPrivileged(req.user)) {
      const qids = await getUserQuartierIds(req.user.id);
      if (qids.length === 0) return res.json(paginate([], 0, page, limit));
      filter.id_quartier = { $in: qids };
    }

    const [data, total] = await Promise.all([
      Evenement.find(filter).sort({ date_debut: 1 }).skip(skip).limit(limit),
      Evenement.countDocuments(filter),
    ]);

    res.json(paginate(data, total, page, limit));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const evenement = await Evenement.findById(req.params.id);
    if (!evenement) return res.status(404).json({ error: 'Événement non trouvé' });
    res.json(evenement);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { titre, description, type, date_debut, date_fin, lieu, capacite_max, id_quartier } = req.body;

    const wanted = id_quartier ? parseInt(id_quartier) : null;
    let quartierId;
    if (isPrivileged(req.user)) {
      quartierId = wanted;
    } else {
      const qids = await getUserQuartierIds(req.user.id);
      if (qids.length === 0) {
        return res.status(400).json({ error: "Rejoignez d'abord un quartier (depuis votre profil) pour créer un événement." });
      }
      quartierId = (wanted && qids.includes(wanted)) ? wanted : qids[0];
    }

    const evenement = await Evenement.create({
      titre, description, type, date_debut, date_fin, lieu, capacite_max,
      id_utilisateur_pg: req.user.id,
      id_quartier: quartierId ?? undefined,
    });

    const session = driver.session();
    try {
      await session.run(
        `MERGE (e:Evenement {mongo_id: $mid})
         MERGE (u:Utilisateur {pg_id: $uid})
         MERGE (u)-[:ORGANISE]->(e)
         ${quartierId ? 'MERGE (q:Quartier {pg_id: $qid}) MERGE (e)-[:TIENT_DANS]->(q)' : ''}`,
        { mid: evenement._id.toString(), qid: quartierId, uid: req.user.id }
      );
    } finally {
      await session.close();
    }

    res.status(201).json(evenement);
  } catch (err) { next(err); }
};

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

exports.participer = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const mid = req.params.id;

    const evenement = await Evenement.findById(mid);
    if (!evenement) return res.status(404).json({ error: 'Événement non trouvé' });

    if (!isPrivileged(req.user)) {
      const qids = await getUserQuartierIds(req.user.id);
      if (!evenement.id_quartier || !qids.includes(evenement.id_quartier)) {
        return res.status(403).json({ error: "Cet événement n'est pas dans votre quartier." });
      }
    }

    if (evenement.capacite_max) {
      const session = driver.session();
      let count = 0;
      try {
        const result = await session.run(
          `MATCH (u:Utilisateur)-[:PARTICIPE]->(e:Evenement {mongo_id: $mid}) RETURN count(u) AS nb`,
          { mid }
        );
        count = result.records[0].get('nb');
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
        pg_id:  r.get('pg_id'),
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

exports.swipe = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const { direction } = req.body;
    if (!['right', 'left'].includes(direction)) {
      return res.status(400).json({ error: 'direction doit être "right" ou "left"' });
    }

    if (!isPrivileged(req.user)) {
      const evenement = await Evenement.findById(req.params.id);
      if (!evenement) return res.status(404).json({ error: 'Événement non trouvé' });
      const qids = await getUserQuartierIds(req.user.id);
      if (!evenement.id_quartier || !qids.includes(evenement.id_quartier)) {
        return res.status(403).json({ error: "Cet événement n'est pas dans votre quartier." });
      }
    }

    const relation = direction === 'right' ? 'A_AIME' : 'A_IGNORE';
    const session  = driver.session();
    try {
      await session.run(
        `MERGE (u:Utilisateur {pg_id: $uid})
         MERGE (e:Evenement {mongo_id: $mid})
         MERGE (u)-[r:${relation}]->(e)
         ON CREATE SET r.date_action = datetime()`,
        { uid: req.user.id, mid: req.params.id }
      );
    } finally {
      await session.close();
    }

    res.status(201).json({ relation });
  } catch (err) { next(err); }
};

exports.suggestions = async (req, res, next) => {
  try {
    const uid     = req.user.id;
    const session = driver.session();
    let mongoIds  = [];
    try {
      const result = await session.run(
        `MATCH (me:Utilisateur {pg_id: $uid})-[:PARTICIPE|A_AIME]->(e1:Evenement)
         <-[:PARTICIPE|A_AIME]-(voisin:Utilisateur)-[:PARTICIPE|A_AIME]->(e2:Evenement)
         WHERE NOT (me)-[:PARTICIPE|A_AIME]->(e2)
           AND NOT (me)-[:A_IGNORE]->(e2)
         RETURN e2.mongo_id AS mongo_id, count(voisin) AS score
         ORDER BY score DESC LIMIT 5`,
        { uid }
      );
      mongoIds = result.records.map((r) => r.get('mongo_id')).filter(Boolean);
    } finally {
      await session.close();
    }

    if (mongoIds.length === 0) return res.json([]);

    const events = await Evenement.find({ _id: { $in: mongoIds }, statut: 'planifie' }).lean();
    res.json(events);
  } catch (err) { next(err); }
};
