const logger = require('../config/logger');

const errorMiddleware = (err, req, res, next) => {
  const status  = err.status || 500;
  const message = err.message || 'Erreur interne du serveur';

  logger.error(`${req.method} ${req.originalUrl} → ${status}`, {
    message,
    stack: status === 500 ? err.stack : undefined,
  });

  res.status(status).json({ error: { status, message } });
};

module.exports = errorMiddleware;
