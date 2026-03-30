// ============================================================
// NEO4J — Contraintes d'unicité sur les nœuds
// À exécuter une seule fois au démarrage
// ============================================================

// Nœuds dont l'ID vient de PostgreSQL
CREATE CONSTRAINT utilisateur_id IF NOT EXISTS
  FOR (u:Utilisateur) REQUIRE u.pg_id IS UNIQUE;

CREATE CONSTRAINT quartier_id IF NOT EXISTS
  FOR (q:Quartier) REQUIRE q.pg_id IS UNIQUE;

CREATE CONSTRAINT contrat_id IF NOT EXISTS
  FOR (c:Contrat) REQUIRE c.pg_id IS UNIQUE;

CREATE CONSTRAINT transaction_id IF NOT EXISTS
  FOR (t:Transaction) REQUIRE t.pg_id IS UNIQUE;

CREATE CONSTRAINT vote_id IF NOT EXISTS
  FOR (v:Vote) REQUIRE v.pg_id IS UNIQUE;

CREATE CONSTRAINT option_vote_id IF NOT EXISTS
  FOR (o:OptionVote) REQUIRE o.pg_id IS UNIQUE;

// Nœuds dont l'ID vient de MongoDB
CREATE CONSTRAINT annonce_id IF NOT EXISTS
  FOR (a:Annonce) REQUIRE a.mongo_id IS UNIQUE;

CREATE CONSTRAINT evenement_id IF NOT EXISTS
  FOR (e:Evenement) REQUIRE e.mongo_id IS UNIQUE;

CREATE CONSTRAINT conversation_id IF NOT EXISTS
  FOR (c:Conversation) REQUIRE c.mongo_id IS UNIQUE;

CREATE CONSTRAINT message_id IF NOT EXISTS
  FOR (m:Message) REQUIRE m.mongo_id IS UNIQUE;

CREATE CONSTRAINT incident_id IF NOT EXISTS
  FOR (i:Incident) REQUIRE i.mongo_id IS UNIQUE;
