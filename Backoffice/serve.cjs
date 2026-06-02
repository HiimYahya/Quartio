const handler = require('serve-handler');
const http = require('http');

const server = http.createServer((req, res) => {
  return handler(req, res, { public: 'dist' });
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`Serveur démarré sur le port ${process.env.PORT || 3000}`);
});