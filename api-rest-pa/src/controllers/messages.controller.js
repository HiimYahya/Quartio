const { driver }             = require('../config/neo4j');
const Message                = require('../models/mongo/message.model');
const Incident               = require('../models/mongo/incident.model');
const validateMongoId        = require('../utils/validateMongoId');
const { createNotification } = require('../utils/notify');

// DELETE /api/messages/:id  (auteur ou admin)
exports.remove = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message non trouvé' });

    if (message.id_utilisateur_pg !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // Soft delete
    await Message.findByIdAndUpdate(req.params.id, { est_supprime: true });
    res.status(204).send();
  } catch (err) { next(err); }
};

// POST /api/messages/:id/signaler  → MongoDB Incident + Neo4j [:SIGNALE]
exports.signaler = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message non trouvé' });

    const { titre, description, type, priorite } = req.body;

    const incident = await Incident.create({
      titre: titre || 'Message signalé',
      description,
      type,
      priorite: priorite || 'normale',
      id_utilisateur_pg: req.user.id,
      id_message: message._id,
    });

    const session = driver.session();
    try {
      await session.run(
        `MERGE (m:Message {mongo_id: $mid})
         MERGE (i:Incident {mongo_id: $iid})
         MERGE (m)-[:SIGNALE]->(i)`,
        { mid: req.params.id, iid: incident._id.toString() }
      );
    } finally {
      await session.close();
    }

    // Notifier les admins (id_utilisateur = 0 → sera ignoré si inexistant)
    createNotification(
      message.id_utilisateur_pg,
      'incident',
      'Votre message a été signalé',
      `Un message que vous avez envoyé a été signalé`,
      incident._id.toString(),
      'incident'
    );

    res.status(201).json(incident);
  } catch (err) { next(err); }
};
