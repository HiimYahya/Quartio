const crypto                 = require('crypto');
const speakeasy              = require('speakeasy');
const pool                   = require('../config/db');
const { driver }             = require('../config/neo4j');
const { getPagination, paginate } = require('../utils/pagination');
const { createNotification } = require('../utils/notify');
const { emitAlert }          = require('../socket/index');
const ContratDocument        = require('../models/mongo/contratdocument.model');

// GET /api/contrats  → mes contrats (vendeur ou acheteur)
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

// GET /api/contrats/:id  (auth — participant ou admin)
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

// POST /api/contrats  (auth)
exports.create = async (req, res, next) => {
  try {
    const { points_echanges, id_annonce_mongo } = req.body;

    const result = await pool.query(
      `INSERT INTO contrat (points_echanges) VALUES ($1) RETURNING *`,
      [points_echanges ?? 0]
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

// PUT /api/contrats/:id/signer
// Chaque participant signe de son côté.
// Quand les 2 ont signé → finalisation automatique :
//   - débit des points de l'acheteur
//   - crédit des points au vendeur
//   - création des transactions PostgreSQL
//   - statut contrat → 'termine'
//   - statut annonce → 'archivee'
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

    // Identifier le rôle du signataire
    const isVendeur  = uid === c.id_vendeur;
    const isAcheteur = uid === c.id_acheteur;
    if (!isVendeur && !isAcheteur)
      return res.status(403).json({ error: 'Vous n\'êtes pas participant à ce contrat' });

    const { signature_dataurl, pdf_base64, mfa_code } = req.body;

    const { rows: uRows } = await pool.query(
      'SELECT nom, prenom, points_solde, mfa_actif, mfa_secret FROM utilisateur WHERE id_utilisateur = $1', [uid]
    );
    const signataire = uRows[0];

    // MFA obligatoire pour signer si activé sur le compte
    if (signataire.mfa_actif) {
      if (!mfa_code)
        return res.status(400).json({ error: 'Code MFA requis pour signer ce contrat' });
      const validMfa = speakeasy.totp.verify({
        secret: signataire.mfa_secret, encoding: 'base32', token: mfa_code, window: 1,
      });
      if (!validMfa)
        return res.status(400).json({ error: 'Code MFA invalide' });
    }

    // Vérifier que l'acheteur a assez de points avant de signer
    const points = c.points_echanges ?? 0;
    if (isAcheteur && points > 0 && signataire.points_solde < points) {
      return res.status(409).json({ error: `Points insuffisants (solde : ${signataire.points_solde} pts, requis : ${points} pts)` });
    }

    // Marquer la signature du participant
    const colSigne = isVendeur ? 'signe_vendeur' : 'signe_acheteur';
    if (c[colSigne])
      return res.status(409).json({ error: 'Vous avez déjà signé ce contrat' });

    await pool.query(
      `UPDATE contrat SET ${colSigne} = TRUE, statut = 'signe' WHERE id_contrat = $1`,
      [contratId]
    );

    // Archive la signature (et le PDF signé si fourni) dans MongoDB
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

    // Recharger pour voir si les 2 ont maintenant signé
    const { rows: refreshed } = await pool.query(
      'SELECT * FROM contrat WHERE id_contrat = $1', [contratId]
    );
    const updated = refreshed[0];

    // ── Finalisation si les deux ont signé ───────────────────────────────────
    if (updated.signe_vendeur && updated.signe_acheteur) {
      // 1. Débit acheteur
      if (points > 0) {
        await pool.query(
          'UPDATE utilisateur SET points_solde = points_solde - $1 WHERE id_utilisateur = $2',
          [points, c.id_acheteur]
        );
        const txDebit = await pool.query(
          `INSERT INTO transaction_points (montant, motif) VALUES ($1, $2) RETURNING *`,
          [-points, `Paiement service — contrat #${contratId}`]
        );

        // 2. Crédit vendeur
        await pool.query(
          'UPDATE utilisateur SET points_solde = points_solde + $1 WHERE id_utilisateur = $2',
          [points, c.id_vendeur]
        );
        const txCredit = await pool.query(
          `INSERT INTO transaction_points (montant, motif) VALUES ($1, $2) RETURNING *`,
          [points, `Encaissement service — contrat #${contratId}`]
        );

        // 3. Relations Neo4j transactions
        const session = driver.session();
        try {
          await session.run(
            `MERGE (c:Contrat {pg_id: $cid})
             MERGE (acheteur:Utilisateur {pg_id: $aid})
             MERGE (vendeur:Utilisateur  {pg_id: $vid})
             MERGE (td:Transaction {pg_id: $tdid}) MERGE (td)-[:EST_POUR]->(acheteur)
             MERGE (tc:Transaction {pg_id: $tcid}) MERGE (tc)-[:EST_POUR]->(vendeur)
             MERGE (c)-[:LIE_A]->(td) MERGE (c)-[:LIE_A]->(tc)`,
            {
              cid:  contratId,
              aid:  c.id_acheteur, vid: c.id_vendeur,
              tdid: txDebit.rows[0].id_transaction,
              tcid: txCredit.rows[0].id_transaction,
            }
          );
        } finally {
          await session.close();
        }
      }

      // 4. Statut contrat → termine
      await pool.query(
        `UPDATE contrat SET statut = 'termine', date_signature = NOW() WHERE id_contrat = $1`,
        [contratId]
      );

      // 5. Archive l'annonce (MongoDB)
      if (c.id_annonce_mongo) {
        const Annonce = require('../models/mongo/annonce.model');
        await Annonce.findByIdAndUpdate(c.id_annonce_mongo, { statut: 'archivee' }).catch(() => {});
      }

      // 6. Notifications
      const autreId = isVendeur ? c.id_acheteur : c.id_vendeur;
      createNotification(autreId, 'contrat',
        'Contrat finalisé',
        `Le contrat #${contratId} est finalisé.${points > 0 ? ` ${points} points ont été transférés.` : ''}`,
        String(contratId), 'contrat'
      );
    } else {
      // Notifier l'autre partie que la signature est en attente
      const autreId = isVendeur ? c.id_acheteur : c.id_vendeur;
      createNotification(autreId, 'contrat',
        'Signature requise',
        `Le contrat #${contratId} attend votre signature.`,
        String(contratId), 'contrat'
      );
      // Alerte temps réel à l'autre partie
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

// GET /api/contrats/:id/document  (auth — participant ou admin)
// Retourne le document archivé dans MongoDB : PDF signé (base64), hash SHA-256, signatures
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

// PUT /api/contrats/:id/statut  (admin)
exports.updateStatut = async (req, res, next) => {
  try {
    const { statut } = req.body;
    const result = await pool.query(
      'UPDATE contrat SET statut=$1 WHERE id_contrat=$2 RETURNING *',
      [statut, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contrat non trouvé' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

// DELETE /api/contrats/:id  (admin)
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
