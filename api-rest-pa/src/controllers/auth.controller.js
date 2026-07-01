const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const pool   = require('../config/db');
const mailer = require('../config/mailer');
const { driver } = require('../config/neo4j');
const { PASSWORD_PATTERN, PASSWORD_MESSAGE } = require('../validators/auth.validator');

const REFRESH_EXPIRES_DAYS = 7;
const WELCOME_POINTS = 100;

const generateRefreshToken = () => crypto.randomBytes(64).toString('hex');

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// Active le compte et crédite les points de bienvenue (utilisé par verifyEmail et,
// si SKIP_EMAIL_VERIFICATION=true, directement par register pour les besoins de test).
const creditWelcomeAndVerify = async (userId) => {
  await pool.query('BEGIN');
  await pool.query(
    'UPDATE utilisateur SET email_verifie = TRUE, points_solde = points_solde + $2 WHERE id_utilisateur = $1',
    [userId, WELCOME_POINTS]
  );
  const tx = await pool.query(
    `INSERT INTO transaction_points (montant, motif) VALUES ($1, $2) RETURNING id_transaction`,
    [WELCOME_POINTS, 'Points de bienvenue']
  );
  await pool.query(
    'UPDATE email_verification SET utilise = TRUE WHERE id_utilisateur = $1',
    [userId]
  );
  await pool.query('COMMIT');

  const session = driver.session();
  try {
    await session.run(
      `MERGE (t:Transaction {pg_id: $tid})
       MERGE (u:Utilisateur {pg_id: $uid})
       MERGE (t)-[:EST_POUR]->(u)`,
      { tid: tx.rows[0].id_transaction, uid: userId }
    );
  } finally {
    await session.close();
  }
};

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { nom, prenom, email, mot_de_passe, telephone, langue } = req.body;

    const existing = await pool.query(
      'SELECT id_utilisateur FROM utilisateur WHERE email = $1', [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    const hash   = await bcrypt.hash(mot_de_passe, 10);
    const result = await pool.query(
      `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, langue)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_utilisateur, nom, prenom, email, role, points_solde, langue, date_inscription`,
      [nom, prenom, email, hash, telephone || null, langue || 'fr']
    );

    const user = result.rows[0];

    // Génère et stocke le code OTP (15 min)
    const code    = generateOtp();
    const expireAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      'INSERT INTO email_verification (id_utilisateur, code, expire_le) VALUES ($1, $2, $3)',
      [user.id_utilisateur, code, expireAt]
    );

    // Envoi de l'email (non-bloquant : on ne fait pas échouer l'inscription si l'email rate)
    mailer.sendVerificationEmail(email, prenom, code).catch(() => {});

    // SKIP_EMAIL_VERIFICATION=true (dev/test uniquement) : le compte est activé
    // immédiatement, sans saisir le code OTP - pas d'envoi SMTP requis.
    if (process.env.SKIP_EMAIL_VERIFICATION === 'true') {
      await creditWelcomeAndVerify(user.id_utilisateur);
      return res.status(201).json({
        utilisateur: { ...user, email_verifie: true },
        email_verification_required: false,
      });
    }

    res.status(201).json({
      utilisateur: user,
      email_verification_required: true,
    });
  } catch (err) { next(err); }
};

// POST /api/auth/verify-email
exports.verifyEmail = async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email et code requis' });
    }

    const userResult = await pool.query(
      'SELECT id_utilisateur, prenom, email_verifie FROM utilisateur WHERE email = $1', [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const user = userResult.rows[0];

    if (user.email_verifie) {
      return res.status(400).json({ error: 'Email déjà vérifié' });
    }

    const tokenResult = await pool.query(
      `SELECT * FROM email_verification
       WHERE id_utilisateur = $1 AND code = $2 AND utilise = FALSE AND expire_le > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [user.id_utilisateur, code]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Code invalide ou expiré' });
    }

    // Active le compte, crédite les points de bienvenue et invalide tous les codes
    await creditWelcomeAndVerify(user.id_utilisateur);

    // Email de bienvenue
    mailer.sendWelcomeEmail(email, user.prenom).catch(() => {});

    res.json({ message: 'Email vérifié avec succès. Vous pouvez maintenant vous connecter.' });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    next(err);
  }
};

// POST /api/auth/resend-verification
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis' });

    const userResult = await pool.query(
      'SELECT id_utilisateur, prenom, email_verifie FROM utilisateur WHERE email = $1', [email]
    );
    if (userResult.rows.length === 0) {
      // Sécurité : ne pas révéler si l'email existe
      return res.json({ message: 'Si cet email existe, un nouveau code a été envoyé.' });
    }

    const user = userResult.rows[0];

    if (user.email_verifie) {
      return res.status(400).json({ error: 'Cet email est déjà vérifié' });
    }

    // Invalide les anciens codes
    await pool.query(
      'UPDATE email_verification SET utilise = TRUE WHERE id_utilisateur = $1',
      [user.id_utilisateur]
    );

    const code     = generateOtp();
    const expireAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      'INSERT INTO email_verification (id_utilisateur, code, expire_le) VALUES ($1, $2, $3)',
      [user.id_utilisateur, code, expireAt]
    );

    mailer.sendVerificationEmail(email, user.prenom, code).catch(() => {});

    res.json({ message: 'Si cet email existe, un nouveau code a été envoyé.' });
  } catch (err) { next(err); }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, mot_de_passe } = req.body;

    const result = await pool.query('SELECT * FROM utilisateur WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const user  = result.rows[0];
    const match = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    if (!match) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Bloquer si le compte est suspendu
    if (user.suspendu_jusqu_au && new Date(user.suspendu_jusqu_au) > new Date()) {
      return res.status(403).json({
        error: `Compte suspendu jusqu'au ${new Date(user.suspendu_jusqu_au).toLocaleDateString('fr-FR')}.`,
      });
    }

    // Bloquer si email non vérifié
    if (user.email_verifie === false) {
      return res.status(403).json({
        error: 'Veuillez vérifier votre adresse email avant de vous connecter.',
        email_verification_required: true,
        email: user.email,
      });
    }

    // MFA activé -> retourner un token temporaire, pas le vrai JWT
    if (user.mfa_actif && user.mfa_secret) {
      const mfaToken = jwt.sign(
        { id: user.id_utilisateur, email: user.email, role: user.role, type: 'mfa' },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
      );
      return res.json({ mfa_required: true, mfa_token: mfaToken });
    }

    // Access token (courte durée)
    const accessToken = jwt.sign(
      { id: user.id_utilisateur, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    // Refresh token (longue durée - 7 jours)
    const refreshToken = generateRefreshToken();
    const expireAt     = new Date();
    expireAt.setDate(expireAt.getDate() + REFRESH_EXPIRES_DAYS);

    await pool.query(
      'INSERT INTO refresh_token (id_utilisateur, token, expire_le) VALUES ($1, $2, $3)',
      [user.id_utilisateur, refreshToken, expireAt]
    );

    res.json({
      access_token:  accessToken,
      refresh_token: refreshToken,
      expires_in:    3600,
      utilisateur: {
        id:           user.id_utilisateur,
        email:        user.email,
        nom:          user.nom,
        prenom:       user.prenom,
        role:         user.role,
        points_solde: user.points_solde,
      },
    });
  } catch (err) { next(err); }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis' });

    const userResult = await pool.query(
      'SELECT id_utilisateur, prenom FROM utilisateur WHERE email = $1', [email]
    );

    // Toujours répondre la même chose (sécurité)
    const genericMsg = { message: "Si cet email est associé à un compte, un lien de réinitialisation a été envoyé." };

    if (userResult.rows.length === 0) return res.json(genericMsg);

    const user     = userResult.rows[0];
    const token    = crypto.randomBytes(64).toString('hex');
    const expireAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    // Invalide les anciens tokens
    await pool.query(
      'UPDATE password_reset SET utilise = TRUE WHERE id_utilisateur = $1',
      [user.id_utilisateur]
    );

    await pool.query(
      'INSERT INTO password_reset (id_utilisateur, token, expire_le) VALUES ($1, $2, $3)',
      [user.id_utilisateur, token, expireAt]
    );

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${token}`;
    mailer.sendResetPasswordEmail(email, user.prenom, resetUrl).catch(() => {});

    res.json(genericMsg);
  } catch (err) { next(err); }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, mot_de_passe } = req.body;
    if (!token || !mot_de_passe) {
      return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
    }
    if (!PASSWORD_PATTERN.test(mot_de_passe)) {
      return res.status(400).json({ error: PASSWORD_MESSAGE });
    }

    const tokenResult = await pool.query(
      `SELECT * FROM password_reset
       WHERE token = $1 AND utilise = FALSE AND expire_le > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Lien de réinitialisation invalide ou expiré' });
    }

    const resetRow = tokenResult.rows[0];
    const hash     = await bcrypt.hash(mot_de_passe, 10);

    await pool.query('BEGIN');
    await pool.query(
      'UPDATE utilisateur SET mot_de_passe = $1 WHERE id_utilisateur = $2',
      [hash, resetRow.id_utilisateur]
    );
    await pool.query(
      'UPDATE password_reset SET utilise = TRUE WHERE id = $1',
      [resetRow.id]
    );
    // Invalide tous les refresh tokens pour forcer la reconnexion
    await pool.query(
      'UPDATE refresh_token SET est_revoque = TRUE WHERE id_utilisateur = $1',
      [resetRow.id_utilisateur]
    );
    await pool.query('COMMIT');

    res.json({ message: 'Mot de passe mis à jour avec succès. Vous pouvez maintenant vous connecter.' });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    next(err);
  }
};

// POST /api/auth/refresh
exports.refresh = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: 'refresh_token manquant' });
    }

    const result = await pool.query(
      `SELECT rt.*, u.email, u.role FROM refresh_token rt
       JOIN utilisateur u ON u.id_utilisateur = rt.id_utilisateur
       WHERE rt.token = $1 AND rt.est_revoque = FALSE AND rt.expire_le > NOW()`,
      [refresh_token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Refresh token invalide ou expiré' });
    }

    const row = result.rows[0];

    const newAccessToken = jwt.sign(
      { id: row.id_utilisateur, email: row.email, role: row.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    res.json({ access_token: newAccessToken, expires_in: 3600 });
  } catch (err) { next(err); }
};

// POST /api/auth/logout
exports.logout = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: 'refresh_token manquant' });
    }

    await pool.query(
      'UPDATE refresh_token SET est_revoque = TRUE WHERE token = $1',
      [refresh_token]
    );

    res.status(204).send();
  } catch (err) { next(err); }
};

// GET /api/auth/sso-token - génère un JWT court (5 min) pour l'app Java Desktop
exports.ssoToken = async (req, res, next) => {
  try {
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email, role: req.user.role, type: 'sso' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    res.json({ sso_token: token, expires_in: 300 });
  } catch (err) { next(err); }
};

// GET /api/auth/me
exports.me = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id_utilisateur, nom, prenom, email, telephone, role,
              points_solde, langue, date_inscription, mfa_actif
       FROM utilisateur WHERE id_utilisateur = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};
