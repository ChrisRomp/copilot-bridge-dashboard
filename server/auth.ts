import type { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { loadConfig } from './config.js';

const SESSION_COOKIE = 'bridge_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory session store (survives hot-reload via tsx watch, not restarts)
const sessions = new Map<string, { createdAt: number; expiresAt: number }>();

function getApiKey(): string | undefined {
  try {
    const config = loadConfig() as any;
    return config.dashboard?.apiKey;
  } catch {
    return undefined;
  }
}

export function isAuthEnabled(): boolean {
  return !!getApiKey();
}

export function getApiKeyValue(): string | undefined {
  return getApiKey();
}

export function validateSessionToken(sessionId: string): boolean {
  return validateSession(sessionId);
}

export function createSessionForResponse(res: Response): string {
  return createSession(res);
}

function createSession(res: Response): string {
  const id = uuid();
  const now = Date.now();
  sessions.set(id, { createdAt: now, expiresAt: now + SESSION_MAX_AGE });
  res.cookie(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    secure: false, // localhost; override for production
  });
  return id;
}

function validateSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return false;
  }
  return true;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Public endpoints
  if (req.path === '/api/health' || req.path === '/api/auth/login') {
    next();
    return;
  }

  // If no API key is configured, auth is disabled — allow everything
  if (!isAuthEnabled()) {
    next();
    return;
  }

  // Check for existing valid session cookie
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (sessionId && validateSession(sessionId)) {
    next();
    return;
  }

  // Check for API key in query param or Authorization header
  const apiKey = getApiKey();
  const providedKey =
    (req.query.apiKey as string) ||
    (req.query.api_key as string) ||
    req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (providedKey && providedKey === apiKey) {
    createSession(res);
    // If this was a query-param auth on a page load, redirect to strip the key from URL
    if (req.query.apiKey || req.query.api_key) {
      const url = new URL(req.originalUrl, `http://${req.headers.host}`);
      url.searchParams.delete('apiKey');
      url.searchParams.delete('api_key');
      res.redirect(302, url.pathname + url.search);
      return;
    }
    next();
    return;
  }

  // Unauthorized
  if (req.path.startsWith('/api/')) {
    res.status(401).json({ error: 'Unauthorized. Provide apiKey query parameter or Authorization header.' });
  } else {
    // For page requests, return a simple auth page
    res.status(401).send(authPage());
  }
}

function authPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Bridge — Auth</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0f1117; color: #e4e6f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .auth-box { background: #1a1d27; border: 1px solid #2e3144; border-radius: 12px; padding: 32px; width: 360px; text-align: center; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { color: #8b8fa3; font-size: 14px; margin-bottom: 24px; }
    input { width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid #2e3144; background: #0f1117; color: #e4e6f0; font-size: 14px; margin-bottom: 16px; box-sizing: border-box; }
    button { width: 100%; padding: 10px; border-radius: 8px; border: none; background: #6c8aff; color: white; font-size: 14px; cursor: pointer; }
    button:hover { background: #8aa2ff; }
    .error { color: #f87171; font-size: 13px; margin-bottom: 12px; display: none; }
  </style>
</head>
<body>
  <div class="auth-box">
    <h1>⎈ The Bridge</h1>
    <p>Enter your API key to continue</p>
    <div class="error" id="error">Invalid API key</div>
    <form onsubmit="auth(event)">
      <input type="password" id="key" placeholder="API key" autofocus />
      <button type="submit">Authenticate</button>
    </form>
  </div>
  <script>
    function auth(e) {
      e.preventDefault();
      const key = document.getElementById('key').value;
      fetch('/api/auth/login', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key }, credentials: 'same-origin' })
        .then(r => { if (r.ok) { window.location.reload(); } else { document.getElementById('error').style.display = 'block'; } })
        .catch(() => { document.getElementById('error').style.display = 'block'; });
    }
  </script>
</body>
</html>`;
}

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now > session.expiresAt) sessions.delete(id);
  }
}, 60 * 60 * 1000); // hourly
