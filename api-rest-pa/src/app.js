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

app.set('trust proxy', 1);

require('./hooks')(appEvents);

app.use(helmet());

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Trop de requêtes, ralentissez' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', globalLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

app.use(express.json({ limit: '15mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// DIAGNOSTIC TEMPORAIRE — teste la connectivité TCP sortante (SMTP vs HTTPS). À retirer.
app.get('/_diag/egress', async (req, res) => {
  const net = require('net');
  const targets = [
    ['smtp.gmail.com', 587],        // SMTP submission
    ['smtp.gmail.com', 465],        // SMTP SSL
    ['smtp-relay.brevo.com', 2525], // SMTP alternatif
    ['smtp-relay.brevo.com', 587],
    ['api.resend.com', 443],        // contrôle HTTPS (doit CONNECTED)
    ['google.com', 443],            // contrôle HTTPS (doit CONNECTED)
  ];
  const test = ([host, port]) => new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let done = false;
    const finish = (status) => { if (done) return; done = true; socket.destroy(); resolve({ host, port, status, ms: Date.now() - start }); };
    socket.setTimeout(8000);
    socket.once('connect', () => finish('CONNECTED'));
    socket.once('timeout', () => finish('TIMEOUT'));
    socket.once('error', (e) => finish('ERROR:' + (e.code || e.message)));
    socket.connect(port, host);
  });
  res.json({ results: await Promise.all(targets.map(test)) });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api', require('./routes/index'));

app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

app.use(errorMiddleware);

module.exports = app;
