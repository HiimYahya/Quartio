const pool            = require('../config/db');
const { driver }      = require('../config/neo4j');
const Conversation    = require('../models/mongo/conversation.model');
const Message         = require('../models/mongo/message.model');
const validateMongoId = require('../utils/validateMongoId');
const { getPagination, paginate } = require('../utils/pagination');

// GET /api/conversations  → mes conversations via Neo4j
exports.getMes = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const session = driver.session();
    let mongoIds = [];
    try {
      const result = await session.run(
        `MATCH (u:Utilisateur {pg_id: $uid})-[:UTILISE]->(c:Conversation)
         RETURN c.mongo_id AS mongo_id`,
        { uid: req.user.id }
      );
      mongoIds = result.records.map((r) => r.get('mongo_id'));
    } finally {
      await session.close();
    }

    if (mongoIds.length === 0) return res.json(paginate([], 0, page, limit));

    const filter = { _id: { $in: mongoIds } };
    const [data, total] = await Promise.all([
      Conversation.find(filter).sort({ date_creation: -1 }).skip(skip).limit(limit),
      Conversation.countDocuments(filter),
    ]);
    res.json(paginate(data, total, page, limit));
  } catch (err) { next(err); }
};

// GET /api/conversations/:id
exports.getById = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation non trouvée' });

    // Vérifier que l'utilisateur est participant
    if (!conv.participants_pg.includes(req.user.id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    res.json(conv);
  } catch (err) { next(err); }
};

// POST /api/conversations  (auth)
exports.create = async (req, res, next) => {
  try {
    const { type, nom, participants } = req.body;

    // S'assurer que le créateur est dans les participants
    const allParticipants = [...new Set([req.user.id, ...participants])];

    const conv = await Conversation.create({
      type: type || 'privee',
      nom,
      date_creation: new Date(),
      participants_pg: allParticipants,
    });

    // Relations Neo4j [:UTILISE] pour chaque participant
    const session = driver.session();
    try {
      for (const uid of allParticipants) {
        await session.run(
          `MERGE (u:Utilisateur {pg_id: $uid})
           MERGE (c:Conversation {mongo_id: $mid})
           MERGE (u)-[:UTILISE]->(c)`,
          { uid, mid: conv._id.toString() }
        );
      }
    } finally {
      await session.close();
    }

    res.status(201).json(conv);
  } catch (err) { next(err); }
};

// GET /api/conversations/:id/messages  → Neo4j → MongoDB
exports.getMessages = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const { page, limit, skip } = getPagination(req.query);

    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation non trouvée' });

    if (!conv.participants_pg.includes(req.user.id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const session = driver.session();
    let mongoIds = [];
    try {
      const result = await session.run(
        `MATCH (m:Message)-[:CONTENU_DANS]->(c:Conversation {mongo_id: $mid})
         RETURN m.mongo_id AS mongo_id`,
        { mid: req.params.id }
      );
      mongoIds = result.records.map((r) => r.get('mongo_id'));
    } finally {
      await session.close();
    }

    if (mongoIds.length === 0) return res.json(paginate([], 0, page, limit));

    const filter = { _id: { $in: mongoIds }, est_supprime: false };
    const [data, total] = await Promise.all([
      Message.find(filter).sort({ date_envoi: 1 }).skip(skip).limit(limit),
      Message.countDocuments(filter),
    ]);
    res.json(paginate(data, total, page, limit));
  } catch (err) { next(err); }
};

// POST /api/conversations/:id/messages  (auth)
exports.envoyerMessage = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation non trouvée' });

    if (!conv.participants_pg.includes(req.user.id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const { type, contenu, media_url } = req.body;

    const message = await Message.create({
      type: type || 'texte',
      contenu,
      media_url,
      id_utilisateur_pg: req.user.id,
      id_conversation: conv._id,
    });

    // Relations Neo4j [:ENVOIE] + [:CONTENU_DANS]
    const session = driver.session();
    try {
      await session.run(
        `MERGE (u:Utilisateur {pg_id: $uid})
         MERGE (m:Message {mongo_id: $mid})
         MERGE (c:Conversation {mongo_id: $cid})
         MERGE (u)-[:ENVOIE]->(m)
         MERGE (m)-[:CONTENU_DANS]->(c)`,
        { uid: req.user.id, mid: message._id.toString(), cid: req.params.id }
      );
    } finally {
      await session.close();
    }

    res.status(201).json(message);
  } catch (err) { next(err); }
};
