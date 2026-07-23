const crypto                 = require('crypto');
const speakeasy              = require('speakeasy');
const pool                   = require('../config/db');
const { driver }             = require('../config/neo4j');
const { getPagination, paginate } = require('../utils/pagination');
const { createNotification } = require('../utils/notify');
const { emitAlert }          = require('../socket/index');
const ContratDocument        = require('../models/mongo/contratdocument.model');
const appEvents               = require('../config/events');
const logger                 = require('../config/logger');

exports.getMes = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const uid = req.user.id;

    const countRes = await pool.query(
      'SELECT COUNT(*) FROM contrat WHERE id_vendeur = $1 OR id_acheteur = $1',
      [uid]
    );
    const result = await pool.query(
      `SELECT c.*,
              v.nom AS vendeur_nom, v.prenom AS vendeur_prenom,
              a.nom AS acheteur_nom, a.prenom AS acheteur_prenom
       FROM contrat c
       LEFT JOIN utilisateur v ON v.id_utilisateur = c.id_vendeur
       LEFT JOIN utilisateur a ON a.id_utilisateur = c.id_acheteur
       WHERE c.id_vendeur = $1 OR c.id_acheteur = $1
       ORDER BY c.date_creation DESC LIMIT $2 OFFSET $3`,
      [uid, limit, skip]
    );
    res.json(paginate(result.rows, parseInt(countRes.rows[0].count), page, limit));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
              v.nom AS vendeur_nom, v.prenom AS vendeur_prenom,
              a.nom AS acheteur_nom, a.prenom AS acheteur_prenom
       FROM contrat c
       LEFT JOIN utilisateur v ON v.id_utilisateur = c.id_vendeur
       LEFT JOIN utilisateur a ON a.id_utilisateur = c.id_acheteur
       WHERE c.id_contrat = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Contrat non trouvé' });

    const c = rows[0];
    const uid = req.user.id;
    if (uid !== c.id_vendeur && uid !== c.id_acheteur && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    res.json(c);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { points_echanges, id_annonce_mongo } = req.body;

    // Le montant vient de l'annonce quand elle est fournie, jamais du body
    let points = Math.max(0, parseInt(points_echanges, 10) || 0);
    if (id_annonce_mongo) {
      const Annonce = require('../models/mongo/annonce.model');
      const annonce = await Annonce.findById(id_annonce_mongo).lean().catch(() => null);
      if (!annonce) return res.status(404).json({ error: 'Annonce non trouvée' });
      points = annonce.est_payant ? (annonce.cout_points ?? 0) : 0;
    }

    const result = await pool.query(
      `INSERT INTO contrat (points_echanges) VALUES ($1) RETURNING *`,
      [points]
    );
    const contrat = result.rows[0];

    const session = driver.session();
    try {
      await session.run(
        `MERGE (c:Contrat {pg_id: $cid})
         MERGE (u:Utilisateur {pg_id: $uid})
         MERGE (u)-[:SIGNE]->(c)`,
        { cid: contrat.id_contrat, uid: req.user.id }
      );

      if (id_annonce_mongo) {
        await session.run(
          `MERGE (a:Annonce {mongo_id: $mid})
           MERGE (c:Contrat {pg_id: $cid})
           MERGE (a)-[:GENERE]->(c)`,
          { mid: id_annonce_mongo, cid: contrat.id_contrat }
        );
      }
    } finally {
      await session.close();
    }

    res.status(201).json(contrat);
  } catch (err) { next(err); }
};

exports.signer = async (req, res, next) => {
  try {
    const contratId = parseInt(req.params.id);
    const uid       = req.user.id;

    const { rows } = await pool.query('SELECT * FROM contrat WHERE id_contrat = $1', [contratId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Contrat non trouvé' });
    const c = rows[0];

    if (c.statut === 'termine')
      return res.status(409).json({ error: 'Ce contrat est déjà finalisé' });
    if (c.statut === 'annule')
      return res.status(409).json({ error: 'Ce contrat a été annulé' });

    const isVendeur  = uid === c.id_vendeur;
    const isAcheteur = uid === c.id_acheteur;
    if (!isVendeur && !isAcheteur)
      return res.status(403).json({ error: 'Vous n\'êtes pas participant à ce contrat' });

    const { signature_dataurl, pdf_base64, mfa_code } = req.body;

    const { rows: uRows } = await pool.query(
      'SELECT nom, prenom, points_solde, mfa_actif, mfa_secret FROM utilisateur WHERE id_utilisateur = $1', [uid]
    );
    const signataire = uRows[0];

    if (signataire.mfa_actif) {
      if (!mfa_code)
        return res.status(400).json({ error: 'Code MFA requis pour signer ce contrat' });
      const validMfa = speakeasy.totp.verify({
        secret: signataire.mfa_secret, encoding: 'base32', token: mfa_code, window: 1,
      });
      if (!validMfa)
        return res.status(400).json({ error: 'Code MFA invalide' });
    }

    const points = c.points_echanges ?? 0;
    if (isAcheteur && points > 0 && signataire.points_solde < points) {
      return res.status(409).json({ error: `Points insuffisants (solde : ${signataire.points_solde} pts, requis : ${points} pts)` });
    }

    const colSigne = isVendeur ? 'signe_vendeur' : 'signe_acheteur';
    if (c[colSigne])
      return res.status(409).json({ error: 'Vous avez déjà signé ce contrat' });

    // Signature et transfert de points dans la même transaction : tout passe ou tout est annulé
    const client = await pool.connect();
    let updated, txDebit = null, txCredit = null;
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE contrat SET ${colSigne} = TRUE, statut = 'signe' WHERE id_contrat = $1`,
        [contratId]
      );
      const { rows: refreshed } = await client.query(
        'SELECT * FROM contrat WHERE id_contrat = $1', [contratId]
      );
      updated = refreshed[0];

      if (updated.signe_vendeur && updated.signe_acheteur) {
        if (points > 0) {
          // 0 ligne touchée = l'acheteur n'a plus assez de points depuis sa signature
          const debit = await client.query(
            `UPDATE utilisateur SET points_solde = points_solde - $1
             WHERE id_utilisateur = $2 AND points_solde >= $1`,
            [points, c.id_acheteur]
          );
          if (debit.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
              error: `Finalisation impossible : le solde de l'acheteur ne couvre plus les ${points} points du contrat`,
            });
          }
          const txD = await client.query(
            `INSERT INTO transaction_points (montant, motif) VALUES ($1, $2) RETURNING *`,
            [-points, `Paiement service - contrat #${contratId}`]
          );
          await client.query(
            'UPDATE utilisateur SET points_solde = points_solde + $1 WHERE id_utilisateur = $2',
            [points, c.id_vendeur]
          );
          const txC = await client.query(
            `INSERT INTO transaction_points (montant, motif) VALUES ($1, $2) RETURNING *`,
            [points, `Encaissement service - contrat #${contratId}`]
          );
          txDebit  = txD.rows[0];
          txCredit = txC.rows[0];
        }
        await client.query(
          `UPDATE contrat SET statut = 'termine', date_signature = NOW() WHERE id_contrat = $1`,
          [contratId]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    {
      const session = driver.session();
      try {
        await session.run(
          `MERGE (u:Utilisateur {pg_id: $uid})
           MERGE (c:Contrat {pg_id: $cid})
           MERGE (u)-[:SIGNE]->(c)`,
          { uid, cid: contratId }
        );
      } finally {
        await session.close();
      }
    }

    if (signature_dataurl || pdf_base64) {
      const mongoUpdate = {
        $push: {
          signatures: {
            id_utilisateur_pg: uid,
            prenom: signataire.prenom,
            nom: signataire.nom,
            dataurl: signature_dataurl,
            signed_at: new Date(),
            ip: req.ip,
          },
        },
      };
      if (pdf_base64) {
        mongoUpdate.$set = {
          pdf_base64,
          hash_sha256: crypto.createHash('sha256').update(Buffer.from(pdf_base64, 'base64')).digest('hex'),
        };
      }
      await ContratDocument.findOneAndUpdate(
        { id_contrat_pg: contratId }, mongoUpdate, { upsert: true }
      ).catch(() => {});
    }

    if (updated.signe_vendeur && updated.signe_acheteur) {
      const session = driver.session();
      try {
        if (txDebit && txCredit) {
          await session.run(
            `MERGE (c:Contrat {pg_id: $cid})
             MERGE (acheteur:Utilisateur {pg_id: $aid})
             MERGE (vendeur:Utilisateur  {pg_id: $vid})
             MERGE (td:Transaction {pg_id: $tdid}) MERGE (td)-[:EST_POUR]->(acheteur)
             MERGE (tc:Transaction {pg_id: $tcid}) MERGE (tc)-[:EST_POUR]->(vendeur)
             MERGE (c)-[:LIE_A]->(td) MERGE (c)-[:LIE_A]->(tc)
             MERGE (vendeur)-[:A_AIDE]->(acheteur)`,
            {
              cid:  contratId,
              aid:  c.id_acheteur, vid: c.id_vendeur,
              tdid: txDebit.id_transaction,
              tcid: txCredit.id_transaction,
            }
          );
        } else {
          await session.run(
            `MERGE (c:Contrat {pg_id: $cid})
             MERGE (acheteur:Utilisateur {pg_id: $aid})
             MERGE (vendeur:Utilisateur  {pg_id: $vid})
             MERGE (vendeur)-[:A_AIDE]->(acheteur)`,
            { cid: contratId, aid: c.id_acheteur, vid: c.id_vendeur }
          );
        }
      } catch (e) {
        // Sans ce lien Neo4j, les transactions n'apparaissent dans aucun historique : on trace pour réparer
        logger.error('Echec écriture Neo4j à la finalisation du contrat', {
          contratId,
          txDebit: txDebit?.id_transaction,
          txCredit: txCredit?.id_transaction,
          err: e.message,
        });
      } finally {
        await session.close();
      }

      if (c.id_annonce_mongo) {
        const Annonce = require('../models/mongo/annonce.model');
        await Annonce.findByIdAndUpdate(c.id_annonce_mongo, { statut: 'archivee' }).catch(() => {});
      }

      const autreId = isVendeur ? c.id_acheteur : c.id_vendeur;
      createNotification(autreId, 'contrat',
        'Contrat finalisé',
        `Le contrat #${contratId} est finalisé.${points > 0 ? ` ${points} points ont été transférés.` : ''}`,
        String(contratId), 'contrat'
      );

      appEvents.emit('contrat.finalise', {
        contratId, idVendeur: c.id_vendeur, idAcheteur: c.id_acheteur, points,
      });
    } else {
      const autreId = isVendeur ? c.id_acheteur : c.id_vendeur;
      createNotification(autreId, 'contrat',
        'Signature requise',
        `Le contrat #${contratId} attend votre signature.`,
        String(contratId), 'contrat'
      );
      if (autreId) {
        emitAlert('contrat', {
          id_contrat: contratId,
          message: `Le contrat #${contratId} attend votre signature.`,
        }, [autreId]);
      }
    }

    const { rows: final } = await pool.query('SELECT * FROM contrat WHERE id_contrat = $1', [contratId]);
    res.json(final[0]);
  } catch (err) { next(err); }
};

exports.getDocument = async (req, res, next) => {
  try {
    const contratId = parseInt(req.params.id);
    const { rows } = await pool.query(
      'SELECT id_vendeur, id_acheteur FROM contrat WHERE id_contrat = $1', [contratId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Contrat non trouvé' });

    const c = rows[0];
    const uid = req.user.id;
    if (uid !== c.id_vendeur && uid !== c.id_acheteur && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const doc = await ContratDocument.findOne({ id_contrat_pg: contratId });
    if (!doc) return res.status(404).json({ error: 'Aucun document archivé pour ce contrat' });

    res.json({
      id_contrat_pg: doc.id_contrat_pg,
      pdf_url:       doc.pdf_url,
      pdf_base64:    doc.pdf_base64,
      hash_sha256:   doc.hash_sha256,
      signatures: doc.signatures.map((s) => ({
        id_utilisateur_pg: s.id_utilisateur_pg,
        prenom:    s.prenom,
        nom:       s.nom,
        signed_at: s.signed_at,
      })),
      updated_at: doc.updatedAt,
    });
  } catch (err) { next(err); }
};

exports.updateStatut = async (req, res, next) => {
  try {
    const { statut } = req.body;

    // 'termine' et 'litige' sont posés par la double signature et le flux litige :
    // les poser à la main fausserait les soldes de points
    if (statut === 'termine' || statut === 'litige') {
      return res.status(409).json({ error: `Le statut "${statut}" ne peut pas être défini manuellement` });
    }

    const { rows } = await pool.query('SELECT statut FROM contrat WHERE id_contrat = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Contrat non trouvé' });
    if (rows[0].statut === 'termine' || rows[0].statut === 'litige') {
      return res.status(409).json({
        error: `Un contrat ${rows[0].statut} ne peut pas être modifié manuellement (les points ont été transférés — passez par la résolution de litige)`,
      });
    }

    const result = await pool.query(
      'UPDATE contrat SET statut=$1 WHERE id_contrat=$2 RETURNING *',
      [statut, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM contrat WHERE id_contrat=$1 RETURNING id_contrat',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contrat non trouvé' });
    res.json({ message: 'Contrat supprimé' });
  } catch (err) { next(err); }
};

const notifierAdmins = async (titre, contenu, id_ressource) => {
  try {
    const { rows } = await pool.query("SELECT id_utilisateur FROM utilisateur WHERE role = 'admin'");
    rows.forEach((a) => createNotification(a.id_utilisateur, 'contrat', titre, contenu, id_ressource, 'contrat'));
  } catch (_) {  }
};

exports.annuler = async (req, res, next) => {
  try {
    const contratId = parseInt(req.params.id);
    const { rows } = await pool.query('SELECT * FROM contrat WHERE id_contrat = $1', [contratId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Contrat non trouvé' });
    const c = rows[0];

    const uid = req.user.id;
    const isVendeur  = uid === c.id_vendeur;
    const isAcheteur = uid === c.id_acheteur;
    if (!isVendeur && !isAcheteur) {
      return res.status(403).json({ error: 'Accès refusé - vous n\'êtes pas partie à ce contrat' });
    }
    if (!['en_attente', 'signe'].includes(c.statut)) {
      return res.status(409).json({ error: `Un contrat ${c.statut} ne peut pas être annulé` });
    }
    const autreASigne = isVendeur ? c.signe_acheteur : c.signe_vendeur;
    if (autreASigne) {
      return res.status(409).json({ error: 'L\'autre partie a déjà signé : annulation impossible (ouvrez un litige)' });
    }

    const { rows: upd } = await pool.query(
      "UPDATE contrat SET statut = 'annule' WHERE id_contrat = $1 RETURNING *", [contratId]
    );

    const autreId = isVendeur ? c.id_acheteur : c.id_vendeur;
    if (autreId) {
      createNotification(autreId, 'contrat', 'Contrat annulé',
        `Le contrat #${contratId} a été annulé par l'autre partie.`, String(contratId), 'contrat');
      emitAlert('contrat', { id_contrat: contratId, message: `Le contrat #${contratId} a été annulé.` }, [autreId]);
    }
    res.json(upd[0]);
  } catch (err) { next(err); }
};

exports.ouvrirLitige = async (req, res, next) => {
  try {
    const contratId = parseInt(req.params.id);
    const { motif } = req.body;
    const { rows } = await pool.query('SELECT * FROM contrat WHERE id_contrat = $1', [contratId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Contrat non trouvé' });
    const c = rows[0];

    const uid = req.user.id;
    if (uid !== c.id_vendeur && uid !== c.id_acheteur) {
      return res.status(403).json({ error: 'Accès refusé - vous n\'êtes pas partie à ce contrat' });
    }
    if (c.statut !== 'termine') {
      return res.status(409).json({ error: 'Un litige ne peut être ouvert que sur un contrat terminé' });
    }

    const { rows: upd } = await pool.query(
      "UPDATE contrat SET statut = 'litige', motif_litige = $2, date_litige = NOW() WHERE id_contrat = $1 RETURNING *",
      [contratId, motif]
    );

    const autreId = uid === c.id_vendeur ? c.id_acheteur : c.id_vendeur;
    if (autreId) {
      createNotification(autreId, 'contrat', 'Litige ouvert',
        `Un litige a été ouvert sur le contrat #${contratId}.`, String(contratId), 'contrat');
    }
    notifierAdmins('Nouveau litige', `Litige ouvert sur le contrat #${contratId} : ${motif}`, String(contratId));
    appEvents.emit('contrat.litige', { contratId, motif, idAuteur: uid });

    res.json(upd[0]);
  } catch (err) { next(err); }
};

exports.getLitiges = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const countRes = await pool.query("SELECT COUNT(*) FROM contrat WHERE statut = 'litige'");
    const result = await pool.query(
      `SELECT c.*,
              v.nom AS vendeur_nom, v.prenom AS vendeur_prenom,
              a.nom AS acheteur_nom, a.prenom AS acheteur_prenom
       FROM contrat c
       LEFT JOIN utilisateur v ON v.id_utilisateur = c.id_vendeur
       LEFT JOIN utilisateur a ON a.id_utilisateur = c.id_acheteur
       WHERE c.statut = 'litige'
       ORDER BY c.date_litige DESC NULLS LAST LIMIT $1 OFFSET $2`,
      [limit, skip]
    );
    res.json(paginate(result.rows, parseInt(countRes.rows[0].count), page, limit));
  } catch (err) { next(err); }
};

exports.resoudreLitige = async (req, res, next) => {
  try {
    const contratId = parseInt(req.params.id);
    const { action, note } = req.body;
    const { rows } = await pool.query('SELECT * FROM contrat WHERE id_contrat = $1', [contratId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Contrat non trouvé' });
    const c = rows[0];
    if (c.statut !== 'litige') {
      return res.status(409).json({ error: 'Ce contrat n\'est pas en litige' });
    }

    const points = c.points_echanges || 0;

    if (action === 'rembourser') {
      // Remboursement tout-ou-rien ; la reprise s'applique même si le vendeur
      // passe en négatif (décision d'arbitrage)
      let txRefund = null, txReprise = null;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (points > 0 && c.id_acheteur && c.id_vendeur) {
          await client.query('UPDATE utilisateur SET points_solde = points_solde + $1 WHERE id_utilisateur = $2', [points, c.id_acheteur]);
          const txR = await client.query(
            'INSERT INTO transaction_points (montant, motif) VALUES ($1, $2) RETURNING *',
            [points, `Remboursement litige - contrat #${contratId}`]
          );
          await client.query('UPDATE utilisateur SET points_solde = points_solde - $1 WHERE id_utilisateur = $2', [points, c.id_vendeur]);
          const txP = await client.query(
            'INSERT INTO transaction_points (montant, motif) VALUES ($1, $2) RETURNING *',
            [-points, `Reprise litige - contrat #${contratId}`]
          );
          txRefund  = txR.rows[0];
          txReprise = txP.rows[0];
        }
        await client.query("UPDATE contrat SET statut = 'annule' WHERE id_contrat = $1", [contratId]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }

      if (txRefund && txReprise) {
        const session = driver.session();
        try {
          await session.run(
            `MERGE (c:Contrat {pg_id: $cid})
             MERGE (acheteur:Utilisateur {pg_id: $aid})
             MERGE (vendeur:Utilisateur  {pg_id: $vid})
             MERGE (tr:Transaction {pg_id: $trid}) MERGE (tr)-[:EST_POUR]->(acheteur)
             MERGE (tp:Transaction {pg_id: $tpid}) MERGE (tp)-[:EST_POUR]->(vendeur)
             MERGE (c)-[:LIE_A]->(tr) MERGE (c)-[:LIE_A]->(tp)`,
            { cid: contratId, aid: c.id_acheteur, vid: c.id_vendeur,
              trid: txRefund.id_transaction, tpid: txReprise.id_transaction }
          );
        } catch (e) {
          logger.error('Echec écriture Neo4j au remboursement du litige', {
            contratId,
            txRefund: txRefund.id_transaction,
            txReprise: txReprise.id_transaction,
            err: e.message,
          });
        } finally {
          await session.close();
        }
      }
    } else {
      await pool.query("UPDATE contrat SET statut = 'termine' WHERE id_contrat = $1", [contratId]);
    }

    const msg = action === 'rembourser'
      ? `Le litige sur le contrat #${contratId} a été tranché : remboursement de ${points} points.`
      : `Le litige sur le contrat #${contratId} a été clos sans remboursement.`;
    [c.id_vendeur, c.id_acheteur].filter(Boolean).forEach((id) =>
      createNotification(id, 'contrat', 'Litige résolu', note ? `${msg} (${note})` : msg, String(contratId), 'contrat')
    );

    const { rows: final } = await pool.query('SELECT * FROM contrat WHERE id_contrat = $1', [contratId]);
    res.json(final[0]);
  } catch (err) { next(err); }
};
