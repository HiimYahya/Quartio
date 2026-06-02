const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const pool   = require('../config/db');

const REFRESH_EXPIRES_DAYS = 7;

const generateRefreshToken = () => crypto.randomBytes(64).toString('hex');

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

    res.status(201).json({ utilisateur: result.rows[0] });
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

    // Access token (courte durée)
    const accessToken = jwt.sign(
      { id: user.id_utilisateur, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    // Refresh token (longue durée — 7 jours)
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

// GET /api/auth/me
exports.me = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id_utilisateur, nom, prenom, email, telephone, role,
              points_solde, langue, date_inscription
       FROM utilisateur WHERE id_utilisateur = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};
