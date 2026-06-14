const mongoose    = require('mongoose');
const connectMongo = require('../src/config/mongodb');

// app.js ne connecte pas MongoDB (c'est fait dans server.js au démarrage du
// serveur). Les tests nécessitant Mongoose (annonces, événements, incidents,
// contrats) ont donc besoin de cette connexion explicite.
beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await connectMongo();
  }
});
