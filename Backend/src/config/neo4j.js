const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

const connectNeo4j = async () => {
  try {
    await driver.verifyConnectivity();
    console.log('Neo4j connecté');
    await initConstraints();
  } catch (err) {
    console.error('Erreur connexion Neo4j :', err.message);
    process.exit(1);
  }
};

const initConstraints = async () => {
  const session = driver.session();
  const constraints = [
    'CREATE CONSTRAINT utilisateur_id IF NOT EXISTS FOR (u:Utilisateur) REQUIRE u.pg_id IS UNIQUE',
    'CREATE CONSTRAINT quartier_id IF NOT EXISTS FOR (q:Quartier) REQUIRE q.pg_id IS UNIQUE',
    'CREATE CONSTRAINT contrat_id IF NOT EXISTS FOR (c:Contrat) REQUIRE c.pg_id IS UNIQUE',
    'CREATE CONSTRAINT transaction_id IF NOT EXISTS FOR (t:Transaction) REQUIRE t.pg_id IS UNIQUE',
    'CREATE CONSTRAINT vote_id IF NOT EXISTS FOR (v:Vote) REQUIRE v.pg_id IS UNIQUE',
    'CREATE CONSTRAINT option_vote_id IF NOT EXISTS FOR (o:OptionVote) REQUIRE o.pg_id IS UNIQUE',
    'CREATE CONSTRAINT annonce_id IF NOT EXISTS FOR (a:Annonce) REQUIRE a.mongo_id IS UNIQUE',
    'CREATE CONSTRAINT evenement_id IF NOT EXISTS FOR (e:Evenement) REQUIRE e.mongo_id IS UNIQUE',
    'CREATE CONSTRAINT conversation_id IF NOT EXISTS FOR (c:Conversation) REQUIRE c.mongo_id IS UNIQUE',
    'CREATE CONSTRAINT message_id IF NOT EXISTS FOR (m:Message) REQUIRE m.mongo_id IS UNIQUE',
    'CREATE CONSTRAINT incident_id IF NOT EXISTS FOR (i:Incident) REQUIRE i.mongo_id IS UNIQUE',
  ];
  try {
    for (const query of constraints) {
      await session.run(query);
    }
    console.log('Contraintes Neo4j initialisées');
  } finally {
    await session.close();
  }
};

module.exports = { driver, connectNeo4j };
