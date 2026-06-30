require('dotenv').config();
const http             = require('http');
const app              = require('./app');
const connectMongo     = require('./config/mongodb');
const { connectNeo4j } = require('./config/neo4j');
const { initSocket }   = require('./socket/index');

const PORT = process.env.PORT || 3000;

const start = async () => {
  await connectMongo();
  await connectNeo4j();

  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
};

start();
