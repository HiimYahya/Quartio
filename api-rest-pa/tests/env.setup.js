// Exécuté par Jest avant le chargement de chaque fichier de test (via
// `setupFiles`), donc avant que `../src/app` (et donc les pools PG/Mongo)
// ne soient require()-és. Bascule les tests sur des bases dédiées
// (pa_db_test / pa_db_test sur Mongo) pour ne pas polluer les données de dev.
process.env.NODE_ENV = 'test';
process.env.DB_NAME  = process.env.DB_NAME_TEST  || 'pa_db_test';
process.env.MONGO_URI = process.env.MONGO_URI_TEST || 'mongodb://mongo:27017/pa_db_test';
