import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './routes/api.js';
import { setupWebSocket } from './ws/live.js';
import { authMiddleware, isAuthEnabled, getApiKeyValue, createSessionForResponse, validateSessionToken } from './auth.js';
import { paths } from './paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);

const PORT = parseInt(process.env.BRIDGE_DASH_PORT ?? '9800', 10);
const HOST = process.env.BRIDGE_DASH_HOST ?? '127.0.0.1';

const ALLOWED_ORIGINS = new Set([
  `http://127.0.0.1:${PORT}`,
  `http://localhost:${PORT}`,
  `http://${HOST}:${PORT}`,
]);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (same-origin, curl, etc.)
    if (!origin || ALLOWED_ORIGINS.has(origin)) cb(null, true);
    else cb(null, false);
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 login attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Auth middleware (checks config for dashboard.apiKey; no-op if not set)
app.use(authMiddleware);

// Login endpoint (exempt from auth — validates key and creates session)
app.post('/api/auth/login', authLimiter, (req, res) => {
  const apiKey = getApiKeyValue();
  if (!apiKey) {
    res.json({ ok: true });
    return;
  }
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (provided && provided === apiKey) {
    createSessionForResponse(res);
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid API key' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Meta endpoint — exposes runtime paths for the client
app.get('/api/meta', (_req, res) => {
  res.json({ bridgeHome: paths.bridgeHome });
});

// API routes
app.use('/api', apiRouter);

// WebSocket for live updates
setupWebSocket(server);

// Serve static client in production
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir));
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'), (err) => {
    if (err) res.status(500).send('Dashboard UI not built — run npm run build');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[the-bridge] Dashboard server running at http://${HOST}:${PORT}`);
});

export { app, server };
