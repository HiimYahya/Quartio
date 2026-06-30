const pool         = require('../config/db');
const { driver }   = require('../config/neo4j');
const speakeasy    = require('speakeasy');
const Annonce      = require('../models/mongo/annonce.model');
const Evenement    = require('../models/mongo/evenement.model');
const Incident     = require('../models/mongo/incident.model');
const Conversation = require('../models/mongo/conversation.model');
const Message      = require('../models/mongo/message.model');

// GET /api/rgpd/export
// Retourne un JSON complet de toutes les données personnelles de l'utilisateur connecté
exports.export = async (req, res, next) => {
  try {
    const uid = req.user.id;
    const toInt = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : Number(v));

    // ── Neo4j : ids liés à l'utilisateur (transactions, votes) + relations ──────
    // Le lien transaction→utilisateur ([:EST_POUR]) et vote→utilisateur ([:REPOND])
    // est porté par Neo4j, pas par une colonne PostgreSQL.
    const session = driver.session();
    let txIds = [], optionIds = [], relations = [];
    try {
      const txRes = await session.run(
        `MATCH (t:Transaction)-[:EST_POUR]->(u:Utilisateur {pg_id: $uid}) RETURN t.pg_id AS pg_id`,
        { uid }
      );
      txIds = txRes.records.map((r) => toInt(r.get('pg_id'))).filter(Number.isFinite);

      const voRes = await session.run(
        `MATCH (u:Utilisateur {pg_id: $uid})-[:REPOND]->(o:OptionVote) RETURN o.pg_id AS pg_id`,
        { uid }
      );
      optionIds = voRes.records.map((r) => toInt(r.get('pg_id'))).filter(Number.isFinite);

      const relRes = await session.run(
        `MATCH (u:Utilisateur {pg_id: $uid})-[r]->(n)
         RETURN type(r) AS relation, labels(n) AS cible, n.pg_id AS cible_pg_id, n.mongo_id AS cible_mongo_id
         LIMIT 200`,
        { uid }
      );
      relations = relRes.records.map((r) => ({
        relation:       r.get('relation'),
        cible:          r.get('cible'),
        cible_pg_id:    r.get('cible_pg_id'),
        cible_mongo_id: r.get('cible_mongo_id'),
      }));
    } finally {
      await session.close();
    }

    // ── PostgreSQL ─────────────────────────────────────────────────────────────
    const [profil, contrats, transactions, notifications, votes] = await Promise.all([
      pool.query(
        `SELECT id_utilisateur, nom, prenom, email, telephone, role,
                points_solde, langue, date_inscription, email_verifie, mfa_actif
         FROM utilisateur WHERE id_utilisateur = $1`,
        [uid]
      ),
      pool.query(
        `SELECT c.id_contrat, c.statut, c.points_echanges, c.date_creation, c.date_signature,
                c.signe_vendeur, c.signe_acheteur,
                c.id_vendeur, c.id_acheteur, c.id_annonce_mongo
         FROM contrat c
         WHERE c.id_vendeur = $1 OR c.id_acheteur = $1
         ORDER BY c.date_creation DESC`,
        [uid]
      ),
      txIds.length
        ? pool.query(
            `SELECT id_transaction, montant, motif, date
             FROM transaction_points WHERE id_transaction = ANY($1::int[])
             ORDER BY date DESC`,
            [txIds]
          )
        : Promise.resolve({ rows: [] }),
      pool.query(
        `SELECT id_notification, type, titre, contenu, id_ressource, type_ressource, est_lue, date_creation
         FROM notification WHERE id_utilisateur = $1
         ORDER BY date_creation DESC`,
        [uid]
      ),
      optionIds.length
        ? pool.query(
            `SELECT v.id_vote, v.titre, ov.libelle AS option_choisie, ov.id_option
             FROM option_vote ov
             JOIN vote v ON v.id_vote = ov.id_vote
             WHERE ov.id_option = ANY($1::int[])`,
            [optionIds]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    // ── MongoDB ────────────────────────────────────────────────────────────────
    const [annonces, evenements, incidents, conversations, messages] = await Promise.all([
      Annonce.find({ id_utilisateur_pg: uid }).lean(),
      Evenement.find({ id_utilisateur_pg: uid }).lean(),
      Incident.find({ id_utilisateur_pg: uid }).lean(),
      Conversation.find({ participants_pg: uid }).lean(),
      Message.find({ id_utilisateur_pg: uid, est_supprime: false }).lean(),
    ]);

    const payload = {
      export_date:   new Date().toISOString(),
      profil:        profil.rows[0] ?? null,
      contrats:      contrats.rows,
      transactions:  transactions.rows,
      notifications: notifications.rows,
      votes:         votes.rows,
      annonces,
      evenements,
      incidents,
      conversations,
      messages,
      relations_neo4j: relations,
    };

    res.setHeader('Content-Disposition', `attachment; filename="quartio-mes-donnees-${uid}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(payload);
  } catch (err) { next(err); }
};

// DELETE /api/rgpd/delete-account
// Suppression totale du compte - nécessite un code MFA si activé, sinon confirmation par mot de passe
exports.deleteAccount = async (req, res, next) => {
  try {
    const uid  = req.user.id;
    const { code, mot_de_passe } = req.body;

    const userRes = await pool.query(
      'SELECT mfa_actif, mfa_secret, mot_de_passe FROM utilisateur WHERE id_utilisateur = $1',
      [uid]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const user = userRes.rows[0];

    // Vérification : MFA si activé, sinon mot de passe
    if (user.mfa_actif) {
      if (!code) return res.status(400).json({ error: 'Code MFA requis' });
      const valid = speakeasy.totp.verify({
        secret: user.mfa_secret, encoding: 'base32', token: code, window: 1,
      });
      if (!valid) return res.status(400).json({ error: 'Code MFA invalide' });
    } else {
      if (!mot_de_passe) return res.status(400).json({ error: 'Mot de passe requis pour confirmer la suppression' });
      const bcrypt = require('bcrypt');
      const match  = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
      if (!match) return res.status(400).json({ error: 'Mot de passe incorrect' });
    }

    // ── Suppression cascade ────────────────────────────────────────────────────

    // MongoDB : anonymiser les messages (RGPD - préserve la cohérence des conversations)
    await Message.updateMany(
      { id_utilisateur_pg: uid },
      { $set: { contenu: '[Message supprimé]', est_supprime: true } }
    );

    // MongoDB : supprimer les annonces, événements, incidents créés par l'utilisateur
    await Promise.all([
      Annonce.deleteMany({ id_utilisateur_pg: uid }),
      Evenement.deleteMany({ id_utilisateur_pg: uid }),
      Incident.deleteMany({ id_utilisateur_pg: uid }),
    ]);

    // Neo4j : supprimer toutes les relations et le nœud Utilisateur
    const session = driver.session();
    try {
      await session.run(
        `MATCH (u:Utilisateur {pg_id: $uid})
         DETACH DELETE u`,
        { uid }
      );
    } finally {
      await session.close();
    }

    // PostgreSQL : CASCADE via FK supprime automatiquement :
    // refresh_token, email_verification, password_reset, notification, transaction_points
    // Les contrats sont gardés (anonymisés via SET NULL) pour l'intégrité comptable
    await pool.query(
      'UPDATE contrat SET id_vendeur = NULL WHERE id_vendeur = $1',
      [uid]
    );
    await pool.query(
      'UPDATE contrat SET id_acheteur = NULL WHERE id_acheteur = $1',
      [uid]
    );
    await pool.query('DELETE FROM utilisateur WHERE id_utilisateur = $1', [uid]);

    res.status(200).json({ message: 'Compte supprimé. Au revoir.' });
  } catch (err) { next(err); }
};
