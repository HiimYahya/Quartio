-- ============================================================
-- SEED PostgreSQL — Données de test
-- Mot de passe : "password123"
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
  ('Environnement', 'Thèmes liés à l écologie et au développement durable'),
  ('Sécurité',      'Thèmes liés à la sécurité du quartier'),
  ('Culture',       'Thèmes liés aux activités culturelles')
ON CONFLICT DO NOTHING;
