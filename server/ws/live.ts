import { watch } from 'chokidar';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import { paths } from '../paths.js';
import { invalidateConfigCache, loadConfig, sanitizeConfig } from '../config.js';
import { isAuthEnabled, getApiKeyValue, validateSessionToken } from '../auth.js';
import cookie from 'cookie';
import fs from 'fs';

interface WsMessage {
  type: string;
  data: unknown;
}

let wss: WebSocketServer | null = null;

export function setupWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req: IncomingMessage) => {
    // Validate auth if enabled
    if (isAuthEnabled()) {
      const cookies = cookie.parse(req.headers.cookie || '');
      const sessionId = cookies.bridge_session;
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const keyParam = url.searchParams.get('apiKey') || url.searchParams.get('api_key');
      const authHeader = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      const apiKey = getApiKeyValue();

      const authenticated =
        (sessionId && validateSessionToken(sessionId)) ||
        (keyParam && keyParam === apiKey) ||
        (authHeader && authHeader === apiKey);

      if (!authenticated) {
        ws.close(4401, 'Unauthorized');
        return;
      }
    }

    ws.send(JSON.stringify({ type: 'connected', data: { timestamp: new Date().toISOString() } }));
  });

  // Watch config file for changes
  const configWatcher = watch(paths.configFile, { ignoreInitial: true });
  configWatcher.on('change', () => {
    invalidateConfigCache();
    try {
      const config = loadConfig();
      broadcast({ type: 'config.changed', data: sanitizeConfig(config) });
    } catch {
      // Config may be mid-write
    }
  });

  // Watch state.db for changes (WAL mode means the -wal file changes)
  const dbWatcher = watch([paths.stateDb, `${paths.stateDb}-wal`], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500 },
  });
  dbWatcher.on('change', () => {
    broadcast({ type: 'db.changed', data: { timestamp: new Date().toISOString() } });
  });

  // Tail the log file
  let logSize = 0;
  try {
    logSize = fs.statSync(paths.logFile).size;
  } catch {
    // Log file may not exist yet
  }

  const logWatcher = watch(paths.logFile, { ignoreInitial: true });
  logWatcher.on('change', () => {
    try {
      const stat = fs.statSync(paths.logFile);
      if (stat.size > logSize) {
        const fd = fs.openSync(paths.logFile, 'r');
        const buffer = Buffer.alloc(stat.size - logSize);
        fs.readSync(fd, buffer, 0, buffer.length, logSize);
        fs.closeSync(fd);
        const newLines = buffer.toString('utf-8');
        broadcast({ type: 'log.lines', data: { lines: newLines } });
      } else if (stat.size < logSize) {
        // Log was truncated/rotated
        broadcast({ type: 'log.rotated', data: {} });
      }
      logSize = stat.size;
    } catch {
      // Log file may have been removed
    }
  });

  return wss;
}

function broadcast(message: WsMessage): void {
  if (!wss) return;
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}
