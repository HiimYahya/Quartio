const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const swaggerUi   = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const errorMiddleware = require('./middlewares/error.middleware');
const logger      = require('./config/logger');
const appEvents   = require('./config/events');

const app = express();

// Derrière le proxy de Railway : nécessaire pour que le rate limiter et les IP
// clientes (req.ip / X-Forwarded-For) soient correctement pris en compte.
app.set('trust proxy', 1);

// ── Hooks (système d'événements internes) ──────────────────────────────────────
// Charge les modules de src/hooks/ qui s'abonnent aux événements métier
// (ex: 'contrat.finalise', 'incident.cree') émis par les controllers.
require('./hooks')(appEvents);

// ── Sécurité ──────────────────────────────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Limit stricte sur les routes d'auth (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limit générale sur toutes les routes API
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  message: { error: 'Trop de requêtes, ralentissez' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', globalLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Logging HTTP ──────────────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ── Parsing ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '15mb' }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Documentation Swagger ─────────────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Routes API ────────────────────────────────────────────────────────────────
app.use('/api', require('./routes/index'));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// ── Gestion des erreurs globale (doit être en dernier) ────────────────────────
app.use(errorMiddleware);

module.exports = app;
