-- ============================================================
-- INIT COMPLET PostgreSQL — à exécuter une seule fois
-- Combine 01_schema + 02_seed + 03_migrations
-- Résout le conflit sur refresh_token (version migration retenue)
-- Mot de passe des comptes de test : "password123"
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS quartier (
  id_quartier   SERIAL PRIMARY KEY,
  nom           VARCHAR(100) NOT NULL,
  geometrie     TEXT,
  date_creation TIMESTAMP DEFAULT NOW()
);

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
  mfa_secret       VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS contrat (
  id_contrat      SERIAL PRIMARY KEY,
  points_echanges INTEGER DEFAULT 0,
  statut          VARCHAR(50) DEFAULT 'en_attente'
                    CHECK (statut IN ('en_attente', 'signe', 'annule', 'termine')),
  date_creation   TIMESTAMP DEFAULT NOW(),
  date_signature  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transaction_points (
  id_transaction SERIAL PRIMARY KEY,
  montant        INTEGER NOT NULL,
  motif          TEXT,
  date           TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vote (
  id_vote      SERIAL PRIMARY KEY,
  titre        VARCHAR(200) NOT NULL,
  description  TEXT,
  type         VARCHAR(50),
  date_debut   TIMESTAMP,
  date_fin     TIMESTAMP,
  est_anonyme  BOOLEAN DEFAULT FALSE,
  statut       VARCHAR(50) DEFAULT 'ouvert'
                 CHECK (statut IN ('ouvert', 'ferme', 'archive'))
);

CREATE TABLE IF NOT EXISTS option_vote (
  id_option SERIAL PRIMARY KEY,
  id_vote   INTEGER NOT NULL REFERENCES vote(id_vote) ON DELETE CASCADE,
  libelle   VARCHAR(200) NOT NULL,
  ordre     INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS theme (
  id_theme        SERIAL PRIMARY KEY,
  titre           VARCHAR(200) NOT NULL,
  caracteristique TEXT
);

-- refresh_token : version migration (plus complète)
CREATE TABLE IF NOT EXISTS refresh_token (
  id_token       SERIAL PRIMARY KEY,
  id_utilisateur INTEGER NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
  token          VARCHAR(512) UNIQUE NOT NULL,
  expire_le      TIMESTAMP NOT NULL,
  est_revoque    BOOLEAN DEFAULT FALSE,
  date_creation  TIMESTAMP DEFAULT NOW()
);

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

-- ============================================================
-- INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_refresh_token_token ON refresh_token(token);
CREATE INDEX IF NOT EXISTS idx_refresh_token_user  ON refresh_token(id_utilisateur);
CREATE INDEX IF NOT EXISTS idx_notification_user    ON notification(id_utilisateur);
CREATE INDEX IF NOT EXISTS idx_notification_est_lue ON notification(id_utilisateur, est_lue);

-- ============================================================
-- DONNÉES DE TEST (seed)
-- ============================================================

INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, role, points_solde)
VALUES
  ('Admin',  'System', 'admin@test.com',  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin',      500),
  ('Dupont', 'Jean',   'jean@test.com',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user',       200),
  ('Martin', 'Claire', 'claire@test.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'moderateur', 300)
ON CONFLICT (email) DO NOTHING;

INSERT INTO quartier (nom) VALUES
  ('Centre-Ville'),
  ('Belleville'),
  ('Montparnasse'),
  ('République')
ON CONFLICT DO NOTHING;

INSERT INTO theme (titre, caracteristique) VALUES
  ('Environnement', 'Thèmes liés à l''écologie et au développement durable'),
  ('Sécurité',      'Thèmes liés à la sécurité du quartier'),
  ('Culture',       'Thèmes liés aux activités culturelles')
ON CONFLICT DO NOTHING;
