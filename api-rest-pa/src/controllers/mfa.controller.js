const speakeasy = require('speakeasy');
const QRCode    = require('qrcode');
const jwt       = require('jsonwebtoken');
const pool      = require('../config/db');

const APP_NAME = 'Quartio';

// GET /api/auth/mfa/setup — génère un secret TOTP + QR code (non activé tant que /activate pas appelé)
exports.setup = async (req, res, next) => {
  try {
    const secret = speakeasy.generateSecret({ name: `${APP_NAME} (${req.user.email})`, length: 20 });

    // Stocke le secret provisoire (pas encore actif)
    await pool.query(
      'UPDATE utilisateur SET mfa_secret = $1 WHERE id_utilisateur = $2',
      [secret.base32, req.user.id]
    );

    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      secret:      secret.base32,
      otpauth_url: secret.otpauth_url,
      qr_code:     qrDataUrl,
    });
  } catch (err) { next(err); }
};

// POST /api/auth/mfa/activate — vérifie le premier code TOTP et active le MFA
exports.activate = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code TOTP requis' });

    const result = await pool.query(
      'SELECT mfa_secret, mfa_actif FROM utilisateur WHERE id_utilisateur = $1',
      [req.user.id]
    );
    const user = result.rows[0];

    if (!user.mfa_secret) {
      return res.status(400).json({ error: 'Aucun secret MFA configuré. Appelez d\'abord GET /api/auth/mfa/setup' });
    }
    if (user.mfa_actif) {
      return res.status(400).json({ error: 'MFA déjà activé' });
    }

    const valid = speakeasy.totp.verify({
      secret:   user.mfa_secret,
      encoding: 'base32',
      token:    code,
      window:   1,
    });

    if (!valid) return res.status(400).json({ error: 'Code invalide' });

    await pool.query(
      'UPDATE utilisateur SET mfa_actif = TRUE WHERE id_utilisateur = $1',
      [req.user.id]
    );

    res.json({ message: 'MFA activé avec succès' });
  } catch (err) { next(err); }
};

// POST /api/auth/mfa/disable — désactive le MFA (nécessite un code TOTP valide)
exports.disable = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code TOTP requis' });

    const result = await pool.query(
      'SELECT mfa_secret, mfa_actif FROM utilisateur WHERE id_utilisateur = $1',
      [req.user.id]
    );
    const user = result.rows[0];

    if (!user.mfa_actif) return res.status(400).json({ error: 'MFA non activé' });

    const valid = speakeasy.totp.verify({
      secret:   user.mfa_secret,
      encoding: 'base32',
      token:    code,
      window:   1,
    });

    if (!valid) return res.status(400).json({ error: 'Code invalide' });

    await pool.query(
      'UPDATE utilisateur SET mfa_actif = FALSE, mfa_secret = NULL WHERE id_utilisateur = $1',
      [req.user.id]
    );

    res.json({ message: 'MFA désactivé' });
  } catch (err) { next(err); }
};

// POST /api/auth/mfa/verify — appelé depuis la page /mfa après login (avec mfa_token)
// Vérifie le code TOTP et retourne le vrai JWT + refresh token
exports.verify = async (req, res, next) => {
  try {
    const { mfa_token, code } = req.body;
    if (!mfa_token || !code) {
      return res.status(400).json({ error: 'mfa_token et code requis' });
    }

    let payload;
    try {
      payload = jwt.verify(mfa_token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token MFA invalide ou expiré' });
    }

    if (payload.type !== 'mfa') {
      return res.status(401).json({ error: 'Token invalide' });
    }

    const result = await pool.query(
      'SELECT * FROM utilisateur WHERE id_utilisateur = $1',
      [payload.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const user = result.rows[0];

    const valid = speakeasy.totp.verify({
      secret:   user.mfa_secret,
      encoding: 'base32',
      token:    code,
      window:   1,
    });

    if (!valid) return res.status(400).json({ error: 'Code invalide' });

    // Émet le vrai JWT
    const accessToken = jwt.sign(
      { id: user.id_utilisateur, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    const crypto = require('crypto');
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + 7);

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

// POST /api/auth/mfa/verify-action — vérifie un code TOTP pour une action sensible (signature, etc.)
// Utilisé par les routes protégées (contrats, changement email, etc.)
exports.verifyAction = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code TOTP requis' });

    const result = await pool.query(
      'SELECT mfa_secret, mfa_actif FROM utilisateur WHERE id_utilisateur = $1',
      [req.user.id]
    );
    const user = result.rows[0];

    if (!user.mfa_actif) return res.status(400).json({ error: 'MFA non activé pour cet utilisateur' });

    const valid = speakeasy.totp.verify({
      secret:   user.mfa_secret,
      encoding: 'base32',
      token:    code,
      window:   1,
    });

    if (!valid) return res.status(400).json({ error: 'Code invalide' });

    res.json({ verified: true });
  } catch (err) { next(err); }
};
