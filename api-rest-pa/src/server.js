require('dotenv').config();
const http             = require('http');
const app              = require('./app');
const connectMongo     = require('./config/mongodb');
const { connectNeo4j } = require('./config/neo4j');
const { initSocket }   = require('./socket/index');
const pool             = require('./config/db');

const PORT = process.env.PORT || 3000;

// Migrations légères idempotentes, appliquées à chaque démarrage
const ensureSchema = async () => {
  await pool.query('ALTER TABLE contrat ADD COLUMN IF NOT EXISTS litige_ouvert_par INTEGER');

  // Répare les votes créés sans quartier (bug admin corrigé) : on retrouve
  // le quartier du créateur via le graphe, sinon le vote reste invisible
  const { rows } = await pool.query('SELECT id_vote FROM vote WHERE id_quartier IS NULL');
  if (rows.length) {
    const { driver } = require('./config/neo4j');
    const session = driver.session();
    try {
      for (const { id_vote } of rows) {
        const res = await session.run(
          `MATCH (u:Utilisateur)-[:CREE]->(:Vote {pg_id: $vid})
           MATCH (u)-[:HABITE]->(q:Quartier)
           RETURN q.pg_id AS qid LIMIT 1`,
          { vid: id_vote }
        );
        const raw = res.records[0]?.get('qid');
        const qid = raw && typeof raw.toNumber === 'function' ? raw.toNumber() : parseInt(raw);
        if (Number.isFinite(qid)) {
          await pool.query('UPDATE vote SET id_quartier = $1 WHERE id_vote = $2', [qid, id_vote]);
          console.log(`Vote ${id_vote} rattaché au quartier ${qid} (réparation)`);
        }
      }
    } finally {
      await session.close();
    }
  }
};

const start = async () => {
  await connectMongo();
  await connectNeo4j();
  await ensureSchema();

  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
};

start();
