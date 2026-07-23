const pool            = require('../config/db');
const { driver }      = require('../config/neo4j');
const cloudinary      = require('../config/cloudinary');
const Conversation    = require('../models/mongo/conversation.model');
const Message         = require('../models/mongo/message.model');
const validateMongoId = require('../utils/validateMongoId');
const { getPagination, paginate } = require('../utils/pagination');
const { emitNewMessage, emitNotification, getUsersInConversation } = require('../socket/index');
const { createNotification } = require('../utils/notify');
const logger = require('../config/logger');

// Notifie les participants d'un nouveau message (sauf l'expéditeur et ceux qui ont
// la conversation ouverte). Une seule notification non lue par conversation :
// si elle existe déjà, on la met à jour au lieu d'en empiler une nouvelle.
async function notifierNouveauMessage(conv, senderId, apercu) {
  try {
    const convId = conv._id.toString();
    const { rows } = await pool.query(
      'SELECT prenom, nom FROM utilisateur WHERE id_utilisateur = $1', [senderId]
    );
    const expediteur = rows[0] ? `${rows[0].prenom} ${rows[0].nom}`.trim() : 'Un voisin';
    const titre = `Nouveau message de ${expediteur}`;

    const dejaDansLaConv = getUsersInConversation(convId);
    const destinataires = conv.participants_pg.filter(
      (uid) => uid !== senderId && !dejaDansLaConv.has(uid)
    );

    for (const uid of destinataires) {
      const { rows: maj } = await pool.query(
        `UPDATE notification SET titre = $1, contenu = $2, date_creation = NOW()
         WHERE id_utilisateur = $3 AND type = 'message' AND id_ressource = $4 AND est_lue = FALSE
         RETURNING *`,
        [titre, apercu, uid, convId]
      );
      const notif = maj[0] ?? await createNotification(uid, 'message', titre, apercu, convId, 'message');
      if (notif) emitNotification(uid, notif);
    }
  } catch (err) {
    logger.error('Erreur notification nouveau message', { err: err.message });
  }
}

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

exports.getById = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const conv = await Conversation.findById(req.params.id).lean();
    if (!conv) return res.status(404).json({ error: 'Conversation non trouvée' });

    if (!conv.participants_pg.includes(req.user.id)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const pgRes = await pool.query(
      'SELECT id_utilisateur AS id, nom, prenom FROM utilisateur WHERE id_utilisateur = ANY($1)',
      [conv.participants_pg]
    );
    conv.participants = pgRes.rows;

    res.json(conv);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { type, nom, participants } = req.body;
    const allParticipants = [...new Set([req.user.id, ...participants])];
    const convType = type || 'privee';

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

    await Message.updateMany(
      { id_conversation: conv._id, id_utilisateur_pg: { $ne: uid }, lu_par: { $not: { $elemMatch: { $eq: uid } } } },
      { $push: { lu_par: uid } }
    );

    // Ouvrir la conversation marque aussi comme lues les notifications associées
    pool.query(
      `UPDATE notification SET est_lue = TRUE
       WHERE id_utilisateur = $1 AND type = 'message' AND id_ressource = $2 AND est_lue = FALSE`,
      [uid, req.params.id]
    ).catch(() => {});

    const filter = { id_conversation: conv._id, est_supprime: false };
    const [data, total] = await Promise.all([
      Message.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
      Message.countDocuments(filter),
    ]);
    res.json(paginate(data, total, page, limit));
  } catch (err) { next(err); }
};

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

    const apercu = (contenu || '').length > 80 ? `${contenu.slice(0, 80)}…` : contenu;
    notifierNouveauMessage(conv, req.user.id, apercu);

    res.status(201).json(message);
  } catch (err) { next(err); }
};

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

    notifierNouveauMessage(conv, req.user.id, 'Vous a envoyé une photo');

    res.status(201).json(message);
  } catch (err) { next(err); }
};
