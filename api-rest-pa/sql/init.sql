-- ============================================================
-- INIT PostgreSQL — schéma complet + seed (à exécuter une fois)
-- Source unique de vérité pour le déploiement (Railway, Docker).
-- Idempotent : CREATE TABLE IF NOT EXISTS + seed ON CONFLICT.
-- Comptes de test : mot de passe = "password123" (email déjà vérifié).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── QUARTIER ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quartier (
  id_quartier   SERIAL PRIMARY KEY,
  nom           VARCHAR(100) NOT NULL,
  geometrie     TEXT,
  date_creation TIMESTAMP DEFAULT NOW()
);

-- ── UTILISATEUR ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS utilisateur (
  id_utilisateur   SERIAL PRIMARY KEY,
  nom              VARCHAR(100) NOT NULL,
  prenom           VARCHAR(100) NOT NULL,
  email            VARCHAR(150) UNIQUE NOT NULL,
  telephone        VARCHAR(20),
  role             VARCHAR(20) NOT NULL DEFAULT 'user'
                     CHECK (role IN ('user', 'admin', 'moderateur')),
  mot_de_passe     VARCHAR(255) NOT NULL,
  points_solde     INTEGER DEFAULT 0,
  langue           VARCHAR(10) DEFAULT 'fr',
  date_inscription TIMESTAMP DEFAULT NOW(),
  mfa_secret       VARCHAR(255),
  email_verifie    BOOLEAN DEFAULT FALSE,
  mfa_actif        BOOLEAN DEFAULT FALSE
);

-- ── CONTRAT ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contrat (
  id_contrat       SERIAL PRIMARY KEY,
  points_echanges  INTEGER DEFAULT 0,
  statut           VARCHAR(50) DEFAULT 'en_attente'
                     CHECK (statut IN ('en_attente', 'signe', 'annule', 'termine', 'litige')),
  date_creation    TIMESTAMP DEFAULT NOW(),
  date_signature   TIMESTAMP,
  id_vendeur       INTEGER REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL,
  id_acheteur      INTEGER REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL,
  id_annonce_mongo VARCHAR(50),
  signe_vendeur    BOOLEAN DEFAULT FALSE,
  signe_acheteur   BOOLEAN DEFAULT FALSE,
  motif_litige     TEXT,
  date_litige      TIMESTAMP
);

-- ── TRANSACTION_POINTS ──────────────────────────────────────
-- (le lien transaction → utilisateur est porté par Neo4j [:EST_POUR])
CREATE TABLE IF NOT EXISTS transaction_points (
  id_transaction SERIAL PRIMARY KEY,
  montant        INTEGER NOT NULL,
  motif          TEXT,
  date           TIMESTAMP DEFAULT NOW()
);

-- ── VOTE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vote (
  id_vote      SERIAL PRIMARY KEY,
  titre        VARCHAR(200) NOT NULL,
  description  TEXT,
  type         VARCHAR(50),
  date_debut   TIMESTAMP,
  date_fin     TIMESTAMP,
  est_anonyme  BOOLEAN DEFAULT FALSE,
  statut       VARCHAR(50) DEFAULT 'ouvert'
                 CHECK (statut IN ('ouvert', 'ferme', 'archive')),
  type_vote    VARCHAR(20) DEFAULT 'choix_multiple'
                 CHECK (type_vote IN ('choix_multiple', 'oui_non', 'classement')),
  nb_choix_max INTEGER DEFAULT 1
);

-- ── OPTION_VOTE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS option_vote (
  id_option SERIAL PRIMARY KEY,
  id_vote   INTEGER NOT NULL REFERENCES vote(id_vote) ON DELETE CASCADE,
  libelle   VARCHAR(200) NOT NULL,
  ordre     INTEGER DEFAULT 0
);

-- ── THEME ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS theme (
  id_theme        SERIAL PRIMARY KEY,
  titre           VARCHAR(200) NOT NULL,
  caracteristique TEXT
);

-- ── REFRESH_TOKEN ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_token (
  id_token       SERIAL PRIMARY KEY,
  id_utilisateur INTEGER NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
  token          VARCHAR(512) UNIQUE NOT NULL,
  expire_le      TIMESTAMP NOT NULL,
  est_revoque    BOOLEAN DEFAULT FALSE,
  date_creation  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_token_token ON refresh_token(token);
CREATE INDEX IF NOT EXISTS idx_refresh_token_user  ON refresh_token(id_utilisateur);

-- ── EMAIL_VERIFICATION ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_verification (
  id             SERIAL PRIMARY KEY,
  id_utilisateur INTEGER NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
  code           VARCHAR(6) NOT NULL,
  expire_le      TIMESTAMP NOT NULL,
  utilise        BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- ── PASSWORD_RESET ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset (
  id             SERIAL PRIMARY KEY,
  id_utilisateur INTEGER NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
  token          VARCHAR(128) UNIQUE NOT NULL,
  expire_le      TIMESTAMP NOT NULL,
  utilise        BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- ── NOTIFICATION ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification (
  id_notification SERIAL PRIMARY KEY,
  id_utilisateur  INTEGER NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
  type            VARCHAR(50) NOT NULL
                    CHECK (type IN ('message', 'evenement', 'contrat', 'vote', 'incident', 'systeme')),
  titre           VARCHAR(200) NOT NULL,
  contenu         TEXT,
  id_ressource    VARCHAR(200),
  type_ressource  VARCHAR(50),
  est_lue         BOOLEAN DEFAULT FALSE,
  date_creation   TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notification_user    ON notification(id_utilisateur);
CREATE INDEX IF NOT EXISTS idx_notification_est_lue ON notification(id_utilisateur, est_lue);

-- ============================================================
-- SEED — données de test (mot de passe "password123", email vérifié)
-- ============================================================
INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, role, points_solde, email_verifie)
VALUES
  ('Admin',  'System', 'admin@test.com',  '$2b$10$iYxDMxeOcQK8wIN7pYqJxudNGAXHhkdcjkZFqDN3utgGPkgjLQEDO', 'admin',      500, TRUE),
  ('Dupont', 'Jean',   'jean@test.com',   '$2b$10$iYxDMxeOcQK8wIN7pYqJxudNGAXHhkdcjkZFqDN3utgGPkgjLQEDO', 'user',       200, TRUE),
  ('Martin', 'Claire', 'claire@test.com', '$2b$10$iYxDMxeOcQK8wIN7pYqJxudNGAXHhkdcjkZFqDN3utgGPkgjLQEDO', 'moderateur', 300, TRUE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO quartier (nom) VALUES
  ('Centre-Ville'), ('Belleville'), ('Montparnasse'), ('République')
ON CONFLICT DO NOTHING;

INSERT INTO theme (titre, caracteristique) VALUES
  ('Environnement', 'Thèmes liés à l écologie et au développement durable'),
  ('Sécurité',      'Thèmes liés à la sécurité du quartier'),
  ('Culture',       'Thèmes liés aux activités culturelles')
ON CONFLICT DO NOTHING;
