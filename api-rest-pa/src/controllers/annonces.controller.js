const pool            = require('../config/db');
const { driver }      = require('../config/neo4j');
const Annonce         = require('../models/mongo/annonce.model');
const validateMongoId = require('../utils/validateMongoId');
const { getPagination, paginate } = require('../utils/pagination');
const { getUserQuartierIds, isPrivileged } = require('../utils/quartiers');

// GET /api/annonces?page=1&limit=20&statut=active&categorie=...&type=...&search=...&payant=true|false
exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { statut, categorie, type, search, payant } = req.query;

    const filter = {};
    if (statut)    filter.statut    = statut;
    if (categorie) filter.categorie = new RegExp(categorie, 'i');
    if (type)      filter.type      = new RegExp(type, 'i');
    if (payant === 'true' || payant === 'false') filter.est_payant = payant === 'true';
    // Recherche plein texte simple sur le titre et la description
    if (search && search.trim()) {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ titre: rx }, { description: rx }];
    }

    // Un habitant ne voit que les annonces de son (ses) quartier(s).
    if (!isPrivileged(req.user)) {
      const qids = await getUserQuartierIds(req.user.id);
      if (qids.length === 0) return res.json(paginate([], 0, page, limit));
      filter.id_quartier = { $in: qids };
    }

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

    // L'annonce est rattachée au quartier de son auteur (l'admin peut cibler un autre quartier).
    const wanted = id_quartier ? parseInt(id_quartier) : null;
    let quartierId;
    if (isPrivileged(req.user)) {
      quartierId = wanted;
    } else {
      const qids = await getUserQuartierIds(req.user.id);
      if (qids.length === 0) {
        return res.status(400).json({ error: "Rejoignez d'abord un quartier (depuis votre profil) pour publier une annonce." });
      }
      quartierId = (wanted && qids.includes(wanted)) ? wanted : qids[0];
    }

    const annonce = await Annonce.create({
      titre, description, type, est_payant, cout_points, categorie, type_concerne,
      id_utilisateur_pg: req.user.id,
      id_quartier: quartierId ?? undefined,
    });

    const session = driver.session();
    try {
      await session.run(
        `MERGE (a:Annonce {mongo_id: $mid})
         MERGE (u:Utilisateur {pg_id: $uid})
         ${quartierId ? 'MERGE (q:Quartier {pg_id: $qid}) MERGE (a)-[:APPARTIENT]->(q)' : ''}`,
        { mid: annonce._id.toString(), qid: quartierId, uid: req.user.id }
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

// POST /api/annonces/:id/contrat  -> crée un contrat depuis une annonce payante
// L'utilisateur connecté devient l'acheteur, l'auteur de l'annonce le vendeur.
exports.creerContrat = async (req, res, next) => {
  try {
    if (!validateMongoId(req.params.id, res)) return;
    const annonce = await Annonce.findById(req.params.id);
    if (!annonce) return res.status(404).json({ error: 'Annonce non trouvée' });

    if (annonce.statut !== 'active')
      return res.status(409).json({ error: 'Cette annonce n\'est plus disponible' });

    // Un habitant ne peut accepter qu'une annonce de son quartier.
    if (!isPrivileged(req.user)) {
      const qids = await getUserQuartierIds(req.user.id);
      if (!annonce.id_quartier || !qids.includes(annonce.id_quartier)) {
        return res.status(403).json({ error: "Cette annonce n'est pas dans votre quartier." });
      }
    }

    const acheteurId = req.user.id;
    const vendeurId  = annonce.id_utilisateur_pg;

    if (acheteurId === vendeurId)
      return res.status(409).json({ error: 'Vous ne pouvez pas accepter votre propre annonce' });

    // Vérifier que l'acheteur a assez de points si l'annonce est payante
    const cout = annonce.est_payant ? (annonce.cout_points ?? 0) : 0;
    if (cout > 0) {
      const { rows } = await pool.query(
        'SELECT points_solde FROM utilisateur WHERE id_utilisateur = $1', [acheteurId]
      );
      if (rows[0].points_solde < cout)
        return res.status(409).json({ error: `Points insuffisants (solde : ${rows[0].points_solde} pts, requis : ${cout} pts)` });
    }

    // Vérifier qu'un contrat n'existe pas déjà entre cet acheteur et cette annonce
    const existing = await pool.query(
      'SELECT id_contrat FROM contrat WHERE id_annonce_mongo = $1 AND id_acheteur = $2',
      [req.params.id, acheteurId]
    );
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'Vous avez déjà un contrat en cours pour cette annonce', id_contrat: existing.rows[0].id_contrat });

    // Créer le contrat
    const { rows } = await pool.query(
      `INSERT INTO contrat (points_echanges, id_vendeur, id_acheteur, id_annonce_mongo)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [cout, vendeurId, acheteurId, req.params.id]
    );
    const contrat = rows[0];

    // Relations Neo4j : les deux participants sont liés au contrat
    const session = driver.session();
    try {
      await session.run(
        `MERGE (acheteur:Utilisateur {pg_id: $aid})
         MERGE (vendeur:Utilisateur  {pg_id: $vid})
         MERGE (c:Contrat            {pg_id: $cid})
         MERGE (a:Annonce            {mongo_id: $mid})
         MERGE (acheteur)-[:SIGNE]->(c)
         MERGE (vendeur)-[:SIGNE]->(c)
         MERGE (a)-[:GENERE]->(c)`,
        { aid: acheteurId, vid: vendeurId, cid: contrat.id_contrat, mid: req.params.id }
      );
    } finally {
      await session.close();
    }

    // Notifier le vendeur
    const { createNotification } = require('../utils/notify');
    createNotification(
      vendeurId, 'contrat',
      'Nouvelle demande de service',
      `Un voisin souhaite bénéficier de votre service "${annonce.titre}". Consultez le contrat #${contrat.id_contrat}.`,
      String(contrat.id_contrat), 'contrat'
    );

    res.status(201).json(contrat);
  } catch (err) { next(err); }
};

// GET /api/annonces/:id/contrat  -> Neo4j [:GENERE] -> PostgreSQL
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
      if (result.records.length > 0) contratId = result.records[0].get('pg_id');
    } finally {
      await session.close();
    }

    if (!contratId) return res.status(404).json({ error: 'Aucun contrat lié à cette annonce' });

    const result = await pool.query('SELECT * FROM contrat WHERE id_contrat = $1', [contratId]);
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};
