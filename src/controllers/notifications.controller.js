const pool = require('../config/db');
const { getPagination, paginate } = require('../utils/pagination');

// GET /api/notifications  → mes notifications
exports.getMes = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { est_lue } = req.query;

    const conditions = [`id_utilisateur = $1`];
    const values     = [req.user.id];

    if (est_lue !== undefined) {
      conditions.push(`est_lue = $${values.length + 1}`);
      values.push(est_lue === 'true');
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const total = (await pool.query(`SELECT COUNT(*) FROM notification ${where}`, values)).rows[0].count;
    const result = await pool.query(
      `SELECT * FROM notification ${where} ORDER BY date_creation DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, skip]
    );

    res.json(paginate(result.rows, parseInt(total), page, limit));
  } catch (err) { next(err); }
};

// PUT /api/notifications/:id/lire  → marquer une notification comme lue
exports.marquerLue = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE notification SET est_lue = TRUE
       WHERE id_notification = $1 AND id_utilisateur = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notification non trouvée' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

// PUT /api/notifications/lire-tout  → marquer toutes comme lues
exports.marquerToutesLues = async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE notification SET est_lue = TRUE WHERE id_utilisateur = $1',
      [req.user.id]
    );
    res.json({ message: 'Toutes les notifications marquées comme lues' });
  } catch (err) { next(err); }
};

// DELETE /api/notifications/:id  → supprimer une notification
exports.remove = async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM notification WHERE id_notification = $1 AND id_utilisateur = $2 RETURNING id_notification',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notification non trouvée' });
    res.status(204).send();
  } catch (err) { next(err); }
};
