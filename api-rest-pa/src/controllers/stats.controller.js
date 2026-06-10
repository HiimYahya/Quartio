const pool      = require('../config/db');
const Annonce   = require('../models/mongo/annonce.model');
const Evenement = require('../models/mongo/evenement.model');
const Incident  = require('../models/mongo/incident.model');

// GET /api/stats  (admin)
exports.getStats = async (req, res, next) => {
  try {
    const now = new Date();

    // ── KPIs globaux ──────────────────────────────────────────────────────────
    const [
      totalUsers, activeUsersRes, pointsRes,
      openIncidents, urgentIncidents,
      contratsTermines, contratsAnnules,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM utilisateur'),
      pool.query(`SELECT COUNT(*) FROM utilisateur WHERE date_inscription > NOW() - INTERVAL '30 days'`),
      pool.query('SELECT COALESCE(SUM(points_solde), 0) AS total FROM utilisateur'),
      pool.query(`SELECT COUNT(*) FROM contrat WHERE statut = 'en_attente'`),
      pool.query(`SELECT COUNT(*) FROM contrat WHERE statut NOT IN ('annule', 'termine')`),
      pool.query(`SELECT COUNT(*) FROM contrat WHERE statut = 'termine'`),
      pool.query(`SELECT COUNT(*) FROM contrat WHERE statut = 'annule'`),
    ]);

    const [
      totalAnnonces, totalEvenements,
      totalIncidents, incidentsUrgents,
    ] = await Promise.all([
      Annonce.countDocuments(),
      Evenement.countDocuments(),
      Incident.countDocuments(),
      Incident.find({ priorite: { $in: ['haute', 'critique'] }, statut: { $in: ['ouvert', 'en_cours'] } })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    // ── Séries hebdomadaires sur 8 semaines ───────────────────────────────────
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      weeks.push({ start, end, label: `S-${i}` });
    }

    const weeklyData = await Promise.all(weeks.map(async ({ start, end, label }) => {
      const [usersRes, pointsWeekRes] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) FROM utilisateur WHERE date_inscription >= $1 AND date_inscription < $2`,
          [start, end]
        ),
        pool.query(
          `SELECT COALESCE(SUM(ABS(montant)), 0) AS total
           FROM transaction_points WHERE date >= $1 AND date < $2`,
          [start, end]
        ),
      ]);

      const [annoncesWeek, eventsWeek] = await Promise.all([
        Annonce.countDocuments({ date_publication: { $gte: start, $lt: end } }),
        Evenement.countDocuments({ createdAt: { $gte: start, $lt: end } }),
      ]);

      return {
        label,
        utilisateurs: parseInt(usersRes.rows[0].count),
        annonces:     annoncesWeek,
        evenements:   eventsWeek,
        points:       parseInt(pointsWeekRes.rows[0].total),
      };
    }));

    // ── Classement utilisateurs par points ───────────────────────────────────
    const rankingRes = await pool.query(
      `SELECT id_utilisateur, prenom, nom, points_solde, role
       FROM utilisateur ORDER BY points_solde DESC LIMIT 10`
    );

    // ── Top catégories d'annonces ─────────────────────────────────────────────
    const topCategories = await Annonce.aggregate([
      { $match: { categorie: { $ne: null } } },
      { $group: { _id: '$categorie', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    // ── Répartition incidents par statut ─────────────────────────────────────
    const incidentsByStatus = await Incident.aggregate([
      { $group: { _id: '$statut', count: { $sum: 1 } } },
    ]);

    res.json({
      kpis: {
        total_utilisateurs:  parseInt(totalUsers.rows[0].count),
        nouveaux_30j:        parseInt(activeUsersRes.rows[0].count),
        points_en_circulation: parseInt(pointsRes.rows[0].total),
        contrats_en_attente: parseInt(openIncidents.rows[0].count),
        contrats_urgents:    parseInt(urgentIncidents.rows[0].count),
        contrats_termines:   parseInt(contratsTermines.rows[0].count),
        contrats_annules:    parseInt(contratsAnnules.rows[0].count),
        total_annonces:      totalAnnonces,
        total_evenements:    totalEvenements,
        total_incidents:     totalIncidents,
        taux_completion:     contratsTermines.rows[0].count > 0
          ? Math.round(parseInt(contratsTermines.rows[0].count) / (parseInt(contratsTermines.rows[0].count) + parseInt(contratsAnnules.rows[0].count)) * 100)
          : 0,
      },
      weekly:           weeklyData,
      ranking:          rankingRes.rows,
      top_categories:   topCategories.map((c) => ({ categorie: c._id, count: c.count })),
      incidents_urgents: incidentsUrgents,
      incidents_by_status: incidentsByStatus.map((i) => ({ statut: i._id, count: i.count })),
    });
  } catch (err) { next(err); }
};
