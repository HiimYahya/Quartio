const pool            = require('../config/db');
const { driver }      = require('../config/neo4j');
const cloudinary      = require('../config/cloudinary');
const Conversation    = require('../models/mongo/conversation.model');
const Message         = require('../models/mongo/message.model');
const validateMongoId = require('../utils/validateMongoId');
const { getPagination, paginate } = require('../utils/pagination');
const { emitNewMessage } = require('../socket/index');

// GET /api/conversations  -> mes conversations enrichies (dernier message + non lus)
exports.getMes = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const uid = req.user.id;

    const session = driver.session();
    let mongoIds = [];
    try {
      const result = await session.run(
        `MATCH (u:Utilisateur {pg_id: $uid})-[:UTILISE]->(c:Conversation)
         RETURN c.mongo_id AS mongo_id`,
        { uid }
      );
      mongoIds = result.records.map((r) => r.get('mongo_id'));
    } finally {
      await session.close();
    }

    if (mongoIds.length === 0) return res.json(paginate([], 0, page, limit));

    const convs = await Conversation.find({ _id: { $in: mongoIds } })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Conversation.countDocuments({ _id: { $in: mongoIds } });

    // Enrichir chaque conversation avec dernier message + nb non lus
    const enriched = await Promise.all(convs.map(async (conv) => {
      const [lastMsg, nonLus] = await Promise.all([
        Message.findOne({ id_conversation: conv._id, est_supprime: false })
          .sort({ createdAt: -1 })
          .lean(),
        Message.countDocuments({
          id_conversation: conv._id,
          est_supprime: false,
          id_utilisateur_pg: { $ne: uid },
          lu_par: { $not: { $elemMatch: { $eq: uid } } },
        }),
      ]);

      // Charger les infos PG des participants (nom/prénom)
      const otherIds = conv.participants_pg.filter((id) => id !== uid);
      let participants = [];
      if (otherIds.length > 0) {
        const pgRes = await pool.query(
          'SELECT id_utilisateur AS id, nom, prenom FROM utilisateur WHERE id_utilisateur = ANY($1)',
          [otherIds]
        );
        participants = pgRes.rows;
      }

      return {
        ...conv,
        participants,
        dernier_message:       lastMsg?.contenu ?? null,
        dernier_message_type:  lastMsg?.type ?? null,
        date_dernier_message:  lastMsg?.createdAt ?? conv.updatedAt,
        non_lus:               nonLus,
      };
    }));

    res.json(paginate(enriched, total, page, limit));
  } catch (err) { next(err); }
};

// GET /api/conversations/:id
exports.getById = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const conv = await Conversation.findById(req.params.id).lean();
    if (!conv) return res.status(404).json({ error: 'Conversation non trouvée' });

    if (!conv.participants_pg.includes(req.user.id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // Enrichir avec les infos PG des participants
    const pgRes = await pool.query(
      'SELECT id_utilisateur AS id, nom, prenom FROM utilisateur WHERE id_utilisateur = ANY($1)',
      [conv.participants_pg]
    );
    conv.participants = pgRes.rows;

    res.json(conv);
  } catch (err) { next(err); }
};

// POST /api/conversations
exports.create = async (req, res, next) => {
  try {
    const { type, nom, participants } = req.body;
    const allParticipants = [...new Set([req.user.id, ...participants])];
    const convType = type || 'privee';

    // Dédup : une conversation privée réunissant exactement les mêmes
    // participants est réutilisée (évite les doublons sur "Contacter").
    if (convType === 'privee') {
      const existing = await Conversation.findOne({
        type: 'privee',
        participants_pg: { $all: allParticipants, $size: allParticipants.length },
      }).lean();
      if (existing) return res.status(200).json(existing);
    }

    const conv = await Conversation.create({
      type: convType,
      nom,
      date_creation: new Date(),
      participants_pg: allParticipants,
    });

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

// GET /api/conversations/:id/messages - marque les messages de l'autre comme lus
exports.getMessages = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const { page, limit, skip } = getPagination(req.query);
    const uid = req.user.id;

    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation non trouvée' });
    if (!conv.participants_pg.includes(uid)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // Marquer comme lus tous les messages de l'autre que l'utilisateur n'a pas encore lus
    await Message.updateMany(
      { id_conversation: conv._id, id_utilisateur_pg: { $ne: uid }, lu_par: { $not: { $elemMatch: { $eq: uid } } } },
      { $push: { lu_par: uid } }
    );

    const filter = { id_conversation: conv._id, est_supprime: false };
    const [data, total] = await Promise.all([
      Message.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
      Message.countDocuments(filter),
    ]);
    res.json(paginate(data, total, page, limit));
  } catch (err) { next(err); }
};

// POST /api/conversations/:id/messages
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
      id_conversation:   conv._id,
      lu_par:            [req.user.id], // l'expéditeur l'a forcément lu
    });

    // Relations Neo4j
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

    // Émettre le message en temps réel via Socket.io
    const msgPayload = message.toObject();
    emitNewMessage(req.params.id, {
      ...msgPayload,
      auteur_id: req.user.id,
    });

    res.status(201).json(message);
  } catch (err) { next(err); }
};

// POST /api/conversations/:id/messages/media - upload d'une image (Cloudinary)
exports.envoyerMessageMedia = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation non trouvée' });
    if (!conv.participants_pg.includes(req.user.id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

    const uploadResult = await cloudinary.uploader.upload(
      `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
      { folder: 'quartio/messages', resource_type: 'image' }
    );

    const message = await Message.create({
      type: 'image',
      media_url: uploadResult.secure_url,
      id_utilisateur_pg: req.user.id,
      id_conversation:   conv._id,
      lu_par:            [req.user.id],
    });

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

    const msgPayload = message.toObject();
    emitNewMessage(req.params.id, {
      ...msgPayload,
      auteur_id: req.user.id,
    });

    res.status(201).json(message);
  } catch (err) { next(err); }
};
