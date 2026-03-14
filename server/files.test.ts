import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isPathSafe, safePath } from './files.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

let tmpRoot: string;

beforeAll(() => {
  // Create a temp directory tree to test against (works on any OS / CI)
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-test-'));
  fs.mkdirSync(path.join(tmpRoot, 'workspaces', 'copilot'), { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, 'config.json'), '{}');
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('isPathSafe', () => {
  it('allows the root path itself', () => {
    expect(isPathSafe(tmpRoot, tmpRoot)).toBe(true);
  });

  it('allows a direct child', () => {
    expect(isPathSafe(path.join(tmpRoot, 'config.json'), tmpRoot)).toBe(true);
  });

  it('allows a nested path', () => {
    expect(isPathSafe(path.join(tmpRoot, 'workspaces', 'copilot'), tmpRoot)).toBe(true);
  });

  it('rejects a parent directory', () => {
    expect(isPathSafe(path.dirname(tmpRoot), tmpRoot)).toBe(false);
  });

  it('rejects an unrelated path', () => {
    expect(isPathSafe('/tmp/evil', tmpRoot)).toBe(false);
  });

  it('rejects the filesystem root', () => {
    expect(isPathSafe('/', tmpRoot)).toBe(false);
  });

  it('rejects a path that starts with the root as a prefix but is not a child', () => {
    expect(isPathSafe(tmpRoot + '-evil/secrets', tmpRoot)).toBe(false);
  });

  it('rejects path traversal with ..', () => {
    expect(isPathSafe(path.join(tmpRoot, 'workspaces', '..', '..', '.ssh', 'id_rsa'), tmpRoot)).toBe(false);
  });

  it('rejects path traversal starting inside root', () => {
    expect(isPathSafe(path.join(tmpRoot, '..', '.ssh', 'authorized_keys'), tmpRoot)).toBe(false);
  });

  it('handles double slashes', () => {
    expect(isPathSafe(tmpRoot + '//config.json', tmpRoot)).toBe(true);
  });

  it('handles trailing slashes', () => {
    expect(isPathSafe(tmpRoot + '/', tmpRoot)).toBe(true);
  });

  it('rejects empty path', () => {
    expect(isPathSafe('', tmpRoot)).toBe(false);
  });

  it('rejects relative path without root prefix', () => {
    expect(isPathSafe('etc/passwd', tmpRoot)).toBe(false);
  });
});

describe('safePath', () => {
  it('returns resolved path for valid paths', () => {
    const result = safePath(path.join(tmpRoot, 'config.json'), tmpRoot);
    expect(result).toBeTruthy();
    expect(result).toContain('config.json');
  });

  it('returns resolved path for root itself', () => {
    const result = safePath(tmpRoot, tmpRoot);
    expect(result).toBeTruthy();
  });

  it('returns null for paths outside root', () => {
    expect(safePath('/tmp/evil', tmpRoot)).toBeNull();
  });

  it('returns null for traversal attacks', () => {
    expect(safePath(path.join(tmpRoot, '..', '..', 'etc', 'passwd'), tmpRoot)).toBeNull();
  });

  it('returns null for empty path', () => {
    expect(safePath('', tmpRoot)).toBeNull();
  });

  it('returns null for relative path', () => {
    expect(safePath('etc/passwd', tmpRoot)).toBeNull();
  });

  it('returns null for prefix-spoofing path', () => {
    expect(safePath(tmpRoot + '-evil/secrets', tmpRoot)).toBeNull();
  });
});
