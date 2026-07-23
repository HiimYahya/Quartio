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
