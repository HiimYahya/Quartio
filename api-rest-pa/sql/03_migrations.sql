-- ============================================================
-- MIGRATION 03 — Refresh tokens + Notifications
-- ============================================================

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
