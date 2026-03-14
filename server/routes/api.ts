import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { loadConfig, sanitizeConfig } from '../config.js';
import {
  getDb,
  getChannelSessions,
  getChannelPrefs,
  getDynamicChannels,
  getPermissionRules,
  getWorkspaceOverrides,
  getScheduledTasks,
  getTaskHistory,
  getAgentCalls,
  getStats,
} from '../db.js';
import { listDirectory, readTextFile, isTextFile } from '../files.js';
import { paths } from '../paths.js';
import path from 'path';
import fs from 'fs';

const router = Router();

// Realpath the root once so symlinked COPILOT_BRIDGE_HOME compares correctly
// against realpathSync'd file paths in route handlers.
const ROOT = fs.realpathSync(paths.bridgeHome);

// Rate limiting applied at router level (defense in depth — also applied in index.ts)
const routerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(routerLimiter);

// --- Config ---
router.get('/config', (_req, res) => {
  try {
    const config = loadConfig();
    res.json(sanitizeConfig(config));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Platforms ---
router.get('/platforms', (_req, res) => {
  try {
    const config = loadConfig();
    const sanitized = sanitizeConfig(config);
    res.json(sanitized.platforms);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Agents ---
router.get('/agents', (_req, res) => {
  try {
    const config = loadConfig();
    const overrides = getWorkspaceOverrides();
    const agents: any[] = [];

    for (const [platformName, platform] of Object.entries(config.platforms)) {
      if (!platform.bots) continue;
      for (const [botName, bot] of Object.entries(platform.bots)) {
        const override = overrides.find((o) => o.bot_name === botName);
        const workspaceDir = override?.working_directory
          ?? path.join(paths.workspaces, botName);

        let hasAgentsFile = false;
        const agentsPath = path.join(workspaceDir, 'AGENTS.md');
        if (fs.existsSync(agentsPath)) {
          hasAgentsFile = true;
        }

        agents.push({
          name: botName,
          platform: platformName,
          agent: bot.agent,
          admin: bot.admin,
          model: bot.model,
          workspace: workspaceDir,
          workspaceExists: fs.existsSync(workspaceDir),
          hasAgentsFile,
          allowPaths: override?.allow_paths ? JSON.parse(override.allow_paths) : [],
        });
      }
    }
    res.json(agents);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Channels ---
router.get('/channels', (_req, res) => {
  try {
    const config = loadConfig();
    const dynamic = getDynamicChannels();
    const sessions = getChannelSessions();
    const prefs = getChannelPrefs();

    const sessionMap = new Map(sessions.map((s) => [s.channel_id, s]));
    const prefsMap = new Map(prefs.map((p) => [p.channel_id, p]));

    const staticChannels = config.channels.map((ch) => ({
      ...ch,
      source: 'config' as const,
      session: sessionMap.get(ch.id) ?? null,
      prefs: prefsMap.get(ch.id) ?? null,
    }));

    const dynamicChannels = dynamic.map((ch) => ({
      id: ch.channel_id,
      platform: ch.platform,
      name: ch.name,
      bot: ch.bot,
      workingDirectory: ch.working_directory,
      agent: ch.agent,
      model: ch.model,
      triggerMode: ch.trigger_mode,
      threadedReplies: !!ch.threaded_replies,
      verbose: !!ch.verbose,
      isDM: !!ch.is_dm,
      source: 'dynamic' as const,
      session: sessionMap.get(ch.channel_id) ?? null,
      prefs: prefsMap.get(ch.channel_id) ?? null,
    }));

    res.json({ static: staticChannels, dynamic: dynamicChannels });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Sessions ---
router.get('/sessions', (_req, res) => {
  try {
    res.json(getChannelSessions());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Permissions ---
router.get('/permissions', (_req, res) => {
  try {
    const config = loadConfig();
    res.json({
      configRules: config.permissions ?? {},
      storedRules: getPermissionRules(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Scheduled tasks ---
router.get('/tasks', (_req, res) => {
  try {
    res.json(getScheduledTasks());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tasks/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    res.json(getTaskHistory(limit));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Agent calls ---
router.get('/agent-calls', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    res.json(getAgentCalls(limit));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Stats ---
router.get('/stats', (_req, res) => {
  try {
    const config = loadConfig();
    const dbStats = getStats();
    const platformCount = Object.keys(config.platforms).length;
    let botCount = 0;
    for (const platform of Object.values(config.platforms)) {
      botCount += Object.keys(platform.bots ?? {}).length;
    }
    res.json({
      ...dbStats,
      platformCount,
      botCount,
      staticChannelCount: config.channels.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Log tail ---
router.get('/logs/tail', (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.lines as string) || 50, 500);
    if (!fs.existsSync(paths.logFile)) {
      res.json({ lines: [] });
      return;
    }
    // Read from end of file to avoid loading entire log into memory
    const fd = fs.openSync(paths.logFile, 'r');
    const stat = fs.fstatSync(fd);
    const chunkSize = Math.min(stat.size, count * 512); // ~512 bytes per line estimate
    const buffer = Buffer.alloc(chunkSize);
    fs.readSync(fd, buffer, 0, chunkSize, Math.max(0, stat.size - chunkSize));
    fs.closeSync(fd);
    const tail = buffer.toString('utf-8');
    const allLines = tail.split('\n').filter((l) => l.trim());
    res.json({ lines: allLines.slice(-count) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Extract a single string from a query parameter (handles arrays from type confusion). */
function queryString(param: unknown): string {
  if (Array.isArray(param)) return String(param[0] ?? '');
  return typeof param === 'string' ? param : '';
}

/**
 * Convert user-provided path to a safe relative path under bridge home.
 * Strips bridgeHome prefix if present, removes leading slashes.
 */
function toRelativePath(raw: string): string {
  let rel = raw;
  if (rel.startsWith(ROOT)) {
    rel = rel.slice(ROOT.length);
  }
  // Remove leading slashes so path.resolve treats it as relative to root
  return rel.replace(/^[/\\]+/, '') || '.';
}

// --- File browser ---
router.get('/files', (req, res) => {
  try {
    const rawPath = queryString(req.query.path);
    const showHidden = req.query.hidden === '1' || req.query.hidden === 'true';
    // CodeQL-recommended pattern: resolve relative to root, realpath, then startsWith check
    const relPath = toRelativePath(rawPath);
    const filePath = fs.realpathSync(path.resolve(ROOT, relPath));
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
      res.status(403).json({ error: 'Access denied: path outside bridge home' });
      return;
    }
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      res.json({ type: 'directory', entries: listDirectory(filePath, showHidden) });
    } else if (isTextFile(filePath)) {
      const { content, truncated } = readTextFile(filePath);
      res.json({ type: 'file', content, truncated, mimeType: 'text/plain' });
    } else {
      res.json({ type: 'file', binary: true, size: stat.size });
    }
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'Not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

router.get('/files/download', (req, res) => {
  try {
    const rawPath = queryString(req.query.path);
    if (!rawPath) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const relPath = toRelativePath(rawPath);
    const filePath = fs.realpathSync(path.resolve(ROOT, relPath));
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    res.download(filePath);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'Not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// --- File upload ---
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const rawPath = queryString(req.query.path);
      const relPath = toRelativePath(rawPath);
      let dirPath: string;
      try {
        dirPath = fs.realpathSync(path.resolve(ROOT, relPath));
      } catch {
        cb(new Error('Target directory does not exist'), '');
        return;
      }
      if (dirPath !== ROOT && !dirPath.startsWith(ROOT + path.sep)) {
        cb(new Error('Access denied: path outside bridge home'), '');
        return;
      }
      try {
        const stat = fs.statSync(dirPath);
        if (!stat.isDirectory()) {
          cb(new Error('Target is not a directory'), '');
          return;
        }
      } catch {
        cb(new Error('Target directory does not exist'), '');
        return;
      }
      cb(null, dirPath);
    },
    filename: (_req, file, cb) => {
      // Strip directory components to prevent path traversal
      cb(null, path.basename(file.originalname));
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

router.post('/files/upload', upload.array('files', 20), (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: 'No files provided' });
    return;
  }
  res.json({
    uploaded: files.map((f) => ({
      name: f.originalname,
      size: f.size,
      path: f.path,
    })),
  });
});

// --- Unified activity feed ---
router.get('/activity', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const d = getDb();

    const taskRows = d.prepare(`
      SELECT id, task_id, description, prompt, status, error, fired_at, timezone
      FROM scheduled_task_history ORDER BY fired_at DESC LIMIT ?
    `).all(limit) as any[];

    const callRows = d.prepare(`
      SELECT id, caller_bot, target_bot, target_agent, message_summary,
             response_summary, duration_ms, success, error, created_at
      FROM agent_calls ORDER BY created_at DESC LIMIT ?
    `).all(limit) as any[];

    const items: any[] = [];

    for (const t of taskRows) {
      items.push({
        type: 'task',
        timestamp: t.fired_at,
        label: t.description || t.prompt?.slice(0, 80) || 'Scheduled task',
        status: t.status,
        error: t.error,
        detail: { taskId: t.task_id, timezone: t.timezone },
      });
    }

    for (const c of callRows) {
      items.push({
        type: 'agent_call',
        timestamp: c.created_at,
        label: c.message_summary?.slice(0, 80) || 'Inter-agent call',
        status: c.success ? 'success' : 'failed',
        error: c.error,
        detail: {
          caller: c.caller_bot,
          target: c.target_bot,
          agent: c.target_agent,
          durationMs: c.duration_ms,
        },
      });
    }

    const validItems = items.filter(a => a.timestamp);
    validItems.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    res.json(validItems.slice(0, limit));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as apiRouter };
