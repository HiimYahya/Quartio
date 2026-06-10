-- ============================================================
-- MIGRATION 03 — Refresh tokens + Notifications
-- ============================================================

-- MIGRATION 05 — Auth sécurisée (vérification email + reset mdp)
ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS email_verifie BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS email_verification (
  id          SERIAL PRIMARY KEY,
  id_utilisateur INTEGER NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
  code        VARCHAR(6) NOT NULL,
  expire_le   TIMESTAMP NOT NULL,
  utilise     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset (
  id          SERIAL PRIMARY KEY,
  id_utilisateur INTEGER NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
  token       VARCHAR(128) UNIQUE NOT NULL,
  expire_le   TIMESTAMP NOT NULL,
  utilise     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- MIGRATION 04 — Colonnes contrat pour le flux payant
ALTER TABLE contrat ADD COLUMN IF NOT EXISTS id_vendeur      INTEGER REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL;
ALTER TABLE contrat ADD COLUMN IF NOT EXISTS id_acheteur     INTEGER REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL;
ALTER TABLE contrat ADD COLUMN IF NOT EXISTS id_annonce_mongo VARCHAR(50);
ALTER TABLE contrat ADD COLUMN IF NOT EXISTS signe_vendeur   BOOLEAN DEFAULT FALSE;
ALTER TABLE contrat ADD COLUMN IF NOT EXISTS signe_acheteur  BOOLEAN DEFAULT FALSE;

-- REFRESH_TOKEN — pour le renouvellement du JWT sans re-login
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

-- NOTIFICATION — notifications in-app pour chaque utilisateur
CREATE TABLE IF NOT EXISTS notification (
  id_notification SERIAL PRIMARY KEY,
  id_utilisateur  INTEGER NOT NULL REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE,
  type            VARCHAR(50) NOT NULL
                    CHECK (type IN ('message', 'evenement', 'contrat', 'vote', 'incident', 'systeme')),
  titre           VARCHAR(200) NOT NULL,
  contenu         TEXT,
  id_ressource    VARCHAR(200),   -- ID de la ressource liée (PG int ou Mongo ObjectId en string)
  type_ressource  VARCHAR(50),    -- 'annonce' | 'evenement' | 'vote' | 'contrat' | 'message'
  est_lue         BOOLEAN DEFAULT FALSE,
  date_creation   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_user    ON notification(id_utilisateur);
CREATE INDEX IF NOT EXISTS idx_notification_est_lue ON notification(id_utilisateur, est_lue);

-- MIGRATION 06 — Votes paramétrables + MFA
ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS mfa_actif   BOOLEAN DEFAULT FALSE;
ALTER TABLE vote        ADD COLUMN IF NOT EXISTS type_vote   VARCHAR(20) DEFAULT 'choix_multiple'
  CHECK (type_vote IN ('choix_multiple', 'oui_non', 'classement'));
ALTER TABLE vote        ADD COLUMN IF NOT EXISTS nb_choix_max INTEGER DEFAULT 1;
