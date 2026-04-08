const pool       = require('../config/db');
const { driver } = require('../config/neo4j');
const { getPagination, paginate } = require('../utils/pagination');

// GET /api/votes?page=1&limit=20&statut=ouvert
exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { statut } = req.query;

    const conditions = [];
    const values     = [];
    if (statut) { conditions.push(`statut = $${values.length + 1}`); values.push(statut); }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total  = (await pool.query(`SELECT COUNT(*) FROM vote ${where}`, values)).rows[0].count;
    const result = await pool.query(
      `SELECT * FROM vote ${where} ORDER BY id_vote LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, skip]
    );

    res.json(paginate(result.rows, parseInt(total), page, limit));
  } catch (err) { next(err); }
};

// GET /api/votes/:id  (avec options)
exports.getById = async (req, res, next) => {
  try {
    const vote = await pool.query('SELECT * FROM vote WHERE id_vote = $1', [req.params.id]);
    if (vote.rows.length === 0) return res.status(404).json({ error: 'Vote non trouvé' });

    const options = await pool.query(
      'SELECT * FROM option_vote WHERE id_vote = $1 ORDER BY ordre', [req.params.id]
    );
    res.json({ ...vote.rows[0], options: options.rows });
  } catch (err) { next(err); }
};

// POST /api/votes  (auth)
exports.create = async (req, res, next) => {
  try {
    const { titre, description, type, date_debut, date_fin, est_anonyme, options, id_themes } = req.body;

    const voteResult = await pool.query(
      `INSERT INTO vote (titre, description, type, date_debut, date_fin, est_anonyme)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [titre, description, type, date_debut, date_fin, est_anonyme ?? false]
    );
    const vote = voteResult.rows[0];

    const insertedOptions = [];
    for (const opt of options) {
      const optResult = await pool.query(
        'INSERT INTO option_vote (id_vote, libelle, ordre) VALUES ($1, $2, $3) RETURNING *',
        [vote.id_vote, opt.libelle, opt.ordre ?? 0]
      );
      insertedOptions.push(optResult.rows[0]);
    }

    const session = driver.session();
    try {
      await session.run(
        `MERGE (u:Utilisateur {pg_id: $uid})
         MERGE (v:Vote {pg_id: $vid})
         MERGE (u)-[:CREE]->(v)`,
        { uid: req.user.id, vid: vote.id_vote }
      );
      for (const themeId of (id_themes || [])) {
        await session.run(
          `MERGE (v:Vote {pg_id: $vid}) MERGE (t:Theme {pg_id: $tid}) MERGE (v)-[:COMPOSE]->(t)`,
          { vid: vote.id_vote, tid: themeId }
        );
      }
      for (const opt of insertedOptions) {
        await session.run('MERGE (o:OptionVote {pg_id: $oid})', { oid: opt.id_option });
      }
    } finally {
      await session.close();
    }

    res.status(201).json({ ...vote, options: insertedOptions });
  } catch (err) { next(err); }
};

// PUT /api/votes/:id  (créateur ou admin)
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = driver.session();
    let isCreateur = false;
    try {
      const result = await session.run(
        `MATCH (u:Utilisateur {pg_id: $uid})-[:CREE]->(v:Vote {pg_id: $vid}) RETURN u`,
        { uid: req.user.id, vid: parseInt(id) }
      );
      isCreateur = result.records.length > 0;
    } finally {
      await session.close();
    }

    if (!isCreateur && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const current = await pool.query('SELECT * FROM vote WHERE id_vote = $1', [id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Vote non trouvé' });

    const v = current.rows[0];
    const { titre, description, statut } = req.body;
    const result = await pool.query(
      `UPDATE vote SET titre=$1, description=$2, statut=$3 WHERE id_vote=$4 RETURNING *`,
      [titre ?? v.titre, description ?? v.description, statut ?? v.statut, id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

// DELETE /api/votes/:id  (admin)
exports.remove = async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM vote WHERE id_vote = $1 RETURNING id_vote', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vote non trouvé' });

    const session = driver.session();
    try {
      await session.run('MATCH (v:Vote {pg_id: $vid}) DETACH DELETE v', { vid: parseInt(req.params.id) });
    } finally {
      await session.close();
    }
    res.status(204).send();
  } catch (err) { next(err); }
};

// POST /api/votes/:id/voter  (auth) → Neo4j [:REPOND]
exports.voter = async (req, res, next) => {
  try {
    const voteId    = parseInt(req.params.id);
    const { id_option } = req.body;

    const opt = await pool.query(
      'SELECT * FROM option_vote WHERE id_option = $1 AND id_vote = $2', [id_option, voteId]
    );
    if (opt.rows.length === 0) return res.status(404).json({ error: 'Option invalide pour ce vote' });

    const vote = await pool.query('SELECT * FROM vote WHERE id_vote = $1', [voteId]);
    if (vote.rows[0].statut !== 'ouvert') {
      return res.status(409).json({ error: 'Ce vote est fermé' });
    }

    const session = driver.session();
    try {
      const existing = await session.run(
        `MATCH (u:Utilisateur {pg_id: $uid})-[:REPOND]->(o:OptionVote)<-[:A_OPTION]-(v:Vote {pg_id: $vid})
         RETURN o`,
        { uid: req.user.id, vid: voteId }
      );
      if (existing.records.length > 0) {
        return res.status(409).json({ error: 'Vous avez déjà voté pour ce vote' });
      }

      await session.run(
        `MERGE (u:Utilisateur {pg_id: $uid})
         MERGE (o:OptionVote {pg_id: $oid})
         MERGE (v:Vote {pg_id: $vid})
         MERGE (v)-[:A_OPTION]->(o)
         MERGE (u)-[r:REPOND]->(o)
         ON CREATE SET r.date_vote = datetime()`,
        { uid: req.user.id, oid: parseInt(id_option), vid: voteId }
      );
    } finally {
      await session.close();
    }

    res.status(201).json({ message: 'Vote enregistré' });
  } catch (err) { next(err); }
};

// GET /api/votes/:id/resultats
exports.getResultats = async (req, res, next) => {
  try {
    const voteId = parseInt(req.params.id);
    const vote   = await pool.query('SELECT * FROM vote WHERE id_vote = $1', [voteId]);
    if (vote.rows.length === 0) return res.status(404).json({ error: 'Vote non trouvé' });

    const options = await pool.query('SELECT * FROM option_vote WHERE id_vote = $1 ORDER BY ordre', [voteId]);

    const session = driver.session();
    let votes = [];
    try {
      const result = await session.run(
        `MATCH (u:Utilisateur)-[:REPOND]->(o:OptionVote)<-[:A_OPTION]-(v:Vote {pg_id: $vid})
         RETURN o.pg_id AS option_id, count(u) AS nb`,
        { vid: voteId }
      );
      votes = result.records.map((r) => ({
        id_option: r.get('option_id').toNumber(),
        nb_votes:  r.get('nb').toNumber(),
      }));
    } finally {
      await session.close();
    }

    const resultats = options.rows.map((opt) => ({
      ...opt,
      nb_votes: votes.find((v) => v.id_option === opt.id_option)?.nb_votes ?? 0,
    }));

    res.json({ vote: vote.rows[0], resultats });
  } catch (err) { next(err); }
};
