import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string;
  mimeType?: string;
}

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.pdf', '.zip', '.gz', '.tar', '.7z', '.rar',
  '.mp3', '.mp4', '.wav', '.avi', '.mov',
  '.exe', '.dll', '.so', '.dylib',
  '.woff', '.woff2', '.ttf', '.eot',
  '.sqlite', '.db', '.db-shm', '.db-wal',
]);

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.mdx', '.json', '.js', '.ts', '.tsx', '.jsx',
  '.css', '.html', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.sh', '.bash', '.zsh', '.py', '.rb', '.go', '.rs', '.java',
  '.c', '.h', '.cpp', '.hpp', '.cs', '.swift', '.sql',
  '.env', '.gitignore', '.dockerignore', '.editorconfig',
  '.log', '.csv', '.diff', '.patch', '.graphql',
  '.makefile', '.dockerfile',
]);

export function listDirectory(dirPath: string, showHidden = false): FileEntry[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries
    .filter((e) => showHidden || !e.name.startsWith('.'))
    .map((entry) => {
      const fullPath = path.join(dirPath, entry.name);
      const stat = fs.statSync(fullPath);
      const ext = path.extname(entry.name).toLowerCase();
      return {
        name: entry.name,
        path: fullPath,
        type: entry.isDirectory() ? 'directory' as const : 'file' as const,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        mimeType: entry.isFile() ? (mime.lookup(entry.name) || 'application/octet-stream') : undefined,
      };
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return false;

  // Known text extension — quick accept
  if (TEXT_EXTENSIONS.has(ext)) return true;

  // Check compound extensions: .md.example → check .md, .json.bak → check .json
  const basename = path.basename(filePath);
  const parts = basename.split('.');
  if (parts.length > 2) {
    for (let i = 1; i < parts.length - 1; i++) {
      const innerExt = '.' + parts[i].toLowerCase();
      if (TEXT_EXTENSIONS.has(innerExt)) return true;
      if (BINARY_EXTENSIONS.has(innerExt)) return false;
    }
  }

  // Dotfiles with no extension (e.g., .gitignore, .env) — treat as text
  if (basename.startsWith('.') && parts.length <= 2) return true;

  // Unknown extension — probe first bytes for binary content (null bytes)
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, buf, 0, 512, 0);
    fs.closeSync(fd);
    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function readTextFile(filePath: string, maxBytes = 1024 * 1024): { content: string; truncated: boolean } {
  const stat = fs.statSync(filePath);
  const truncated = stat.size > maxBytes;
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(Math.min(stat.size, maxBytes));
  fs.readSync(fd, buffer, 0, buffer.length, 0);
  fs.closeSync(fd);
  return { content: buffer.toString('utf-8'), truncated };
}

/**
 * Validates a path is within the allowed root.
 * Returns the resolved (real) path if safe, or null if unsafe.
 * Callers MUST use the returned path for all filesystem operations
 * so the sanitized value is traceable through the code.
 */
export function safePath(requestedPath: string, allowedRoot: string): string | null {
  if (!requestedPath || !path.isAbsolute(requestedPath)) return null;
  // Normalize to resolve . segments and collapse separators
  const normalized = path.normalize(requestedPath);
  // Check for '..' path segments (segment-based to avoid false positives on filenames like my..notes.txt)
  const segments = normalized.split(path.sep);
  if (segments.includes('..')) return null;
  // Resolve the allowed root
  let root: string;
  try {
    root = fs.realpathSync(allowedRoot);
  } catch {
    root = path.resolve(allowedRoot);
  }
  // Lexical boundary check BEFORE any filesystem operation on the requested path.
  // This prevents path injection by ensuring the path is within root before touching disk.
  if (normalized !== root && !normalized.startsWith(root + path.sep)) return null;
  // Resolve symlinks to prevent escape via symlinked directories
  let resolved: string;
  try {
    resolved = fs.realpathSync(normalized);
  } catch {
    // Path doesn't exist yet (e.g., upload target) — fall back to lexical resolve
    resolved = path.resolve(normalized);
  }
  if (resolved === root || resolved.startsWith(root + path.sep)) return resolved;
  return null;
}

/** @deprecated Use safePath() which returns the resolved path. */
export function isPathSafe(requestedPath: string, allowedRoot: string): boolean {
  return safePath(requestedPath, allowedRoot) !== null;
}
