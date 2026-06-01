require('dotenv').config();
const app = require('./app');
const connectMongo = require('./config/mongodb');
const { connectNeo4j } = require('./config/neo4j');
const pool = require('./config/db');

const PORT = process.env.PORT || 3000;

const start = async () => {
  await connectMongo();
  await connectNeo4j();
  
  try {
    await pool.query('SELECT 1');
    console.log('PostgreSQL connecté');
  } catch (err) {
    console.error('Erreur connexion PostgreSQL :', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
};

start();