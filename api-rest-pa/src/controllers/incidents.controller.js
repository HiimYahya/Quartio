const Incident        = require('../models/mongo/incident.model');
const validateMongoId = require('../utils/validateMongoId');
const { getPagination, paginate } = require('../utils/pagination');

// GET /api/incidents?page=1&limit=20&statut=ouvert&priorite=haute  (admin)
exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { statut, priorite }  = req.query;

    const filter = {};
    if (statut)   filter.statut   = statut;
    if (priorite) filter.priorite = priorite;

    const [data, total] = await Promise.all([
      Incident.find(filter).sort({ date_signalement: -1 }).skip(skip).limit(limit),
      Incident.countDocuments(filter),
    ]);

    res.json(paginate(data, total, page, limit));
  } catch (err) { next(err); }
};

// GET /api/incidents/:id  (auth)
exports.getById = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident non trouvé' });
    res.json(incident);
  } catch (err) { next(err); }
};

// POST /api/incidents  (auth)
exports.create = async (req, res, next) => {
  try {
    const { titre, description, type, priorite } = req.body;
    const incident = await Incident.create({
      titre, description, type,
      priorite: priorite || 'normale',
      id_utilisateur_pg: req.user.id,
    });
    res.status(201).json(incident);
  } catch (err) { next(err); }
};

// PUT /api/incidents/:id  (admin)
exports.update = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident non trouvé' });

    const updated = await Incident.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json(updated);
  } catch (err) { next(err); }
};

// DELETE /api/incidents/:id  (admin)
exports.remove = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident non trouvé' });
    await incident.deleteOne();
    res.status(204).send();
  } catch (err) { next(err); }
};
