const mongoose = require('mongoose');

const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connecté');
  } catch (err) {
    console.error('Erreur connexion MongoDB :', err.message);
    process.exit(1);
  }
};

module.exports = connectMongo;
