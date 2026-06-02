require('dotenv').config();
const app = require('./app');
const connectMongo = require('./config/mongodb');
const { connectNeo4j } = require('./config/neo4j');

const PORT = process.env.PORT || 3000;

const start = async () => {
  await connectMongo();
  await connectNeo4j();
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
};

start();
