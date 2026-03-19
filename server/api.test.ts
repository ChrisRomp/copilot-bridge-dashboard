import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Integration tests for the file browser API's access control.
// These test the actual HTTP endpoints to verify that the server
// enforces path safety at the API layer.
//
// NOTE: These tests require the dashboard server to be running on port 9800.
// Start it with: npm run dev:server (or npm run dev)
// Run separately with: npx vitest run server/api.test.ts

const BASE = 'http://127.0.0.1:9800';

async function fetchApi(path: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

describe('File API access control', () => {
  it('GET /api/files without path returns bridge home directory', async () => {
    const { status, body } = await fetchApi('/api/files');
    expect(status).toBe(200);
    expect(body.type).toBe('directory');
    expect(body.entries).toBeDefined();
    expect(Array.isArray(body.entries)).toBe(true);
  });

  it('GET /api/files with valid nested path succeeds', async () => {
    const { status, body } = await fetchApi('/api/files?path=/Users/chris/.copilot-bridge/workspaces');
    expect(status).toBe(200);
    expect(body.type).toBe('directory');
  });

  it('rejects path outside bridge home (parent dir)', async () => {
    const { status, body } = await fetchApi('/api/files?path=/Users/chris');
    expect(status).toBe(403);
    expect(body.error).toMatch(/access denied/i);
  });

  it('rejects path outside bridge home (unrelated dir)', async () => {
    const { status, body } = await fetchApi('/api/files?path=/tmp');
    expect(status).toBe(403);
    expect(body.error).toMatch(/access denied/i);
  });

  it('rejects path traversal attack with ..', async () => {
    const { status, body } = await fetchApi(
      '/api/files?path=/Users/chris/.copilot-bridge/workspaces/../../.ssh',
    );
    expect(status).toBe(403);
    expect(body.error).toMatch(/access denied/i);
  });

  it('rejects root path', async () => {
    const { status, body } = await fetchApi('/api/files?path=/');
    expect(status).toBe(403);
    expect(body.error).toMatch(/access denied/i);
  });

  it('rejects prefix-collision path (.copilot-bridge-evil)', async () => {
    const { status, body } = await fetchApi(
      '/api/files?path=/Users/chris/.copilot-bridge-evil',
    );
    expect(status).toBe(403);
    expect(body.error).toMatch(/access denied/i);
  });

  it('rejects download outside bridge home', async () => {
    const { status, body } = await fetchApi(
      '/api/files/download?path=/etc/passwd',
    );
    expect(status).toBe(403);
    expect(body.error).toMatch(/access denied/i);
  });

  it('rejects download with path traversal', async () => {
    const { status, body } = await fetchApi(
      '/api/files/download?path=/Users/chris/.copilot-bridge/../.ssh/id_rsa',
    );
    expect(status).toBe(403);
    expect(body.error).toMatch(/access denied/i);
  });

  it('returns 404 for non-existent path within bridge home', async () => {
    const { status } = await fetchApi(
      '/api/files?path=/Users/chris/.copilot-bridge/nonexistent_xyz',
    );
    expect(status).toBe(404);
  });
});

// --- Download endpoint tests ---
// These need a known file to exist within bridge home.
// We use the config file which always exists.

async function fetchRaw(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`);
}

describe('File download endpoint', () => {
  it('downloads a valid file with correct headers', async () => {
    const res = await fetchRaw('/api/files/download?path=/Users/chris/.copilot-bridge/config.json');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('content-disposition')).toMatch(/attachment/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Number(res.headers.get('content-length'))).toBeGreaterThan(0);
  });

  it('rejects directory download with 400', async () => {
    const res = await fetchRaw('/api/files/download?path=/Users/chris/.copilot-bridge/workspaces');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not a file/i);
  });

  it('rejects download without path param', async () => {
    const res = await fetchRaw('/api/files/download');
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent file download', async () => {
    const res = await fetchRaw('/api/files/download?path=/Users/chris/.copilot-bridge/nonexistent_file.txt');
    expect(res.status).toBe(404);
  });
});
