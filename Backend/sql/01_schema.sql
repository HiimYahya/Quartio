-- ============================================================
-- SCHÉMA PostgreSQL — Données structurées & transactionnelles
-- ============================================================
-- Contient : utilisateur, quartier, contrat, transaction_points,
--            vote, option_vote, theme
-- Les relations entre entités → Neo4j
-- Les documents riches (annonce, evenement, message, etc.) → MongoDB
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- QUARTIER — référentiel géographique
CREATE TABLE IF NOT EXISTS quartier (
  id_quartier   SERIAL PRIMARY KEY,
  nom           VARCHAR(100) NOT NULL,
  geometrie     TEXT,
  date_creation TIMESTAMP DEFAULT NOW()
);

-- UTILISATEUR — données d'auth et de compte (ACID requis)
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

-- CONTRAT — données légales/financières (ACID requis)
CREATE TABLE IF NOT EXISTS contrat (
  id_contrat      SERIAL PRIMARY KEY,
  points_echanges INTEGER DEFAULT 0,
  statut          VARCHAR(50) DEFAULT 'en_attente'
                    CHECK (statut IN ('en_attente', 'signe', 'annule', 'termine')),
  date_creation   TIMESTAMP DEFAULT NOW(),
  date_signature  TIMESTAMP
);

-- TRANSACTION_POINTS — historique financier (ACID requis)
CREATE TABLE IF NOT EXISTS transaction_points (
  id_transaction SERIAL PRIMARY KEY,
  montant        INTEGER NOT NULL,
  motif          TEXT,
  date           TIMESTAMP DEFAULT NOW()
);

-- VOTE — intégrité des votes (ACID requis)
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

-- OPTION_VOTE — options liées à un vote (intégrité référentielle forte)
CREATE TABLE IF NOT EXISTS option_vote (
  id_option SERIAL PRIMARY KEY,
  id_vote   INTEGER NOT NULL REFERENCES vote(id_vote) ON DELETE CASCADE,
  libelle   VARCHAR(200) NOT NULL,
  ordre     INTEGER DEFAULT 0
);

-- THEME — référentiel de thèmes
CREATE TABLE IF NOT EXISTS theme (
  id_theme        SERIAL PRIMARY KEY,
  titre           VARCHAR(200) NOT NULL,
  caracteristique TEXT
);
