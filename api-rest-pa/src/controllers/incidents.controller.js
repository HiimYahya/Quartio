const pool            = require('../config/db');
const Incident        = require('../models/mongo/incident.model');
const validateMongoId = require('../utils/validateMongoId');
const { getPagination, paginate } = require('../utils/pagination');
const appEvents       = require('../config/events');

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { statut, priorite, signalements } = req.query;

    if (signalements === 'true' && !['admin', 'moderateur'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé - rôle requis : admin ou moderateur' });
    }

    const filter = {};
    if (signalements === 'true') {
      filter.id_message = { $exists: true, $ne: null };
    } else {
      filter.id_message = { $exists: false };
    }
    if (statut)   filter.statut   = statut;
    if (priorite) filter.priorite = priorite;

    const [data, total] = await Promise.all([
      Incident.find(filter).sort({ date_signalement: -1 }).skip(skip).limit(limit).populate('id_message').lean(),
      Incident.countDocuments(filter),
    ]);

    if (data.length) {
      // auteur = créateur du ticket (ou signaleur) ; message_auteur = auteur du message signalé
      const userIds = [...new Set(data.flatMap((i) =>
        [i.id_utilisateur_pg, i.id_message?.id_utilisateur_pg]
      ).filter((v) => v != null))];
      let users = [];
      if (userIds.length) {
        const pgRes = await pool.query(
          'SELECT id_utilisateur AS id, nom, prenom FROM utilisateur WHERE id_utilisateur = ANY($1)',
          [userIds]
        );
        users = pgRes.rows;
      }
      data.forEach((inc) => {
        inc.auteur = users.find((u) => u.id === inc.id_utilisateur_pg) || null;
        if (signalements === 'true') {
          inc.message_auteur = users.find((u) => u.id === inc.id_message?.id_utilisateur_pg) || null;
        }
      });
    }

    res.json(paginate(data, total, page, limit));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident non trouvé' });
    res.json(incident);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { titre, description, type, priorite } = req.body;
    const incident = await Incident.create({
      titre, description, type,
      priorite: priorite || 'normale',
      id_utilisateur_pg: req.user.id,
    });

    appEvents.emit('incident.cree', {
      incidentId: incident._id.toString(), priorite: incident.priorite,
    });

    res.status(201).json(incident);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident non trouvé' });

    const updated = await Incident.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json(updated);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident non trouvé' });
    await incident.deleteOne();
    res.status(204).send();
  } catch (err) { next(err); }
};
