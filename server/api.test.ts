import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';

// Integration tests for the file browser API.
// Tests the HTTP endpoints for basic functionality and path traversal protection.
//
// NOTE: Requires the dashboard server running on port 9800.
// Start with: npm run dev:server (or npm run dev)
//
// All paths are derived dynamically — no hardcoded user directories.

const BASE = 'http://127.0.0.1:9800';

async function fetchApi(urlPath: string): Promise<{ status: number; body: any; headers: Headers }> {
  const res = await fetch(`${BASE}${urlPath}`);
  const body = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
}

async function fetchRaw(urlPath: string): Promise<{ status: number; headers: Headers; text: string }> {
  const res = await fetch(`${BASE}${urlPath}`);
  return { status: res.status, headers: res.headers, text: await res.text() };
}

let BRIDGE_HOME: string;
let VALID_CHILD: string;
let DOWNLOADABLE_FILE: string | null;

describe('File API', () => {
  beforeAll(async () => {
    const { body } = await fetchApi('/api/files');
    const firstEntry = body?.entries?.[0]?.path;
    if (!firstEntry) throw new Error('Could not discover bridge home from /api/files');
    BRIDGE_HOME = path.dirname(firstEntry);
    const dir = body.entries.find((e: any) => e.type === 'directory');
    VALID_CHILD = dir?.path ?? path.join(BRIDGE_HOME, 'workspaces');
    const file = body.entries.find((e: any) => e.type === 'file');
    DOWNLOADABLE_FILE = file?.path ?? null;
  });

  describe('file listing', () => {
    it('returns bridge home directory by default', async () => {
      const { status, body } = await fetchApi('/api/files');
      expect(status).toBe(200);
      expect(body.type).toBe('directory');
      expect(Array.isArray(body.entries)).toBe(true);
    });

    it('lists a valid nested directory', async () => {
      const { status, body } = await fetchApi(
        `/api/files?path=${encodeURIComponent(VALID_CHILD)}`,
      );
      expect(status).toBe(200);
      expect(body.type).toBe('directory');
    });

    it('rejects path traversal with ..', async () => {
      // Use string concat to preserve literal .. (path.join normalizes them away)
      const traversal = BRIDGE_HOME + '/../.ssh';
      const { status, body } = await fetchApi(
        `/api/files?path=${encodeURIComponent(traversal)}`,
      );
      expect(status).toBe(403);
      expect(body.error).toMatch(/access denied/i);
    });

    it('returns 404 for non-existent path within bridge home', async () => {
      const fakePath = path.join(BRIDGE_HOME, 'nonexistent_xyz_' + Date.now());
      const { status } = await fetchApi(
        `/api/files?path=${encodeURIComponent(fakePath)}`,
      );
      expect(status).toBe(404);
    });
  });

  describe('file download', () => {
    it('rejects download with path traversal', async () => {
      const traversal = BRIDGE_HOME + '/../.ssh/id_rsa';
      const { status, body } = await fetchApi(
        `/api/files/download?path=${encodeURIComponent(traversal)}`,
      );
      expect(status).toBe(403);
      expect(body.error).toMatch(/access denied/i);
    });

    it('rejects download without path param', async () => {
      const { status, body } = await fetchApi('/api/files/download');
      expect(status).toBe(403);
      expect(body.error).toMatch(/access denied/i);
    });

    it('returns 404 for non-existent file', async () => {
      const fakePath = path.join(BRIDGE_HOME, 'nonexistent_file_' + Date.now());
      const { status } = await fetchApi(
        `/api/files/download?path=${encodeURIComponent(fakePath)}`,
      );
      expect(status).toBe(404);
    });

    it('downloads a file with correct headers', async () => {
      if (!DOWNLOADABLE_FILE) return;
      const { status, headers } = await fetchRaw(
        `/api/files/download?path=${encodeURIComponent(DOWNLOADABLE_FILE)}`,
      );
      expect(status).toBe(200);
      expect(headers.get('content-disposition')).toBeTruthy();
      expect(headers.get('content-length')).toBeTruthy();
      expect(headers.get('x-content-type-options')).toBe('nosniff');
    });

    it('serves inline with ?inline=1 for images', async () => {
      if (!DOWNLOADABLE_FILE) return;
      // Use any file — non-images should still get attachment disposition
      const { status, headers } = await fetchRaw(
        `/api/files/download?path=${encodeURIComponent(DOWNLOADABLE_FILE)}&inline=1`,
      );
      expect(status).toBe(200);
      expect(headers.get('content-disposition')).toBeTruthy();
    });
  });
});
