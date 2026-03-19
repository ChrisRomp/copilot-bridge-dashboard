import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';

// Integration tests for the file browser API's access control.
// These test the actual HTTP endpoints to verify that the server
// enforces path safety at the API layer.
//
// NOTE: These tests require the dashboard server to be running on port 9800.
// Start it with: npm run dev:server (or npm run dev)
// Run separately with: npx vitest run server/api.test.ts

const BASE = 'http://127.0.0.1:9800';

// Resolved dynamically from the server's /api/meta endpoint
let BRIDGE_HOME: string;

beforeAll(async () => {
  const res = await fetch(`${BASE}/api/meta`);
  const meta = await res.json() as { bridgeHome: string };
  BRIDGE_HOME = meta.bridgeHome;
});

async function fetchApi(urlPath: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${urlPath}`);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function fetchRaw(urlPath: string): Promise<Response> {
  return fetch(`${BASE}${urlPath}`);
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
    const { status, body } = await fetchApi(`/api/files?path=${encodeURIComponent(path.join(BRIDGE_HOME, 'workspaces'))}`);
    expect(status).toBe(200);
    expect(body.type).toBe('directory');
  });

  it('rejects path outside bridge home (parent dir)', async () => {
    const parent = path.dirname(BRIDGE_HOME);
    const { status, body } = await fetchApi(`/api/files?path=${encodeURIComponent(parent)}`);
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
      `/api/files?path=${encodeURIComponent(path.join(BRIDGE_HOME, 'workspaces', '..', '..', '.ssh'))}`,
    );
    expect(status).toBe(403);
    expect(body.error).toMatch(/access denied/i);
  });

  it('rejects root path', async () => {
    const { status, body } = await fetchApi('/api/files?path=/');
    expect(status).toBe(403);
    expect(body.error).toMatch(/access denied/i);
  });

  it('rejects prefix-collision path', async () => {
    const { status, body } = await fetchApi(
      `/api/files?path=${encodeURIComponent(BRIDGE_HOME + '-evil')}`,
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
      `/api/files/download?path=${encodeURIComponent(path.join(BRIDGE_HOME, '..', '.ssh', 'id_rsa'))}`,
    );
    expect(status).toBe(403);
    expect(body.error).toMatch(/access denied/i);
  });

  it('returns 404 for non-existent path within bridge home', async () => {
    const { status } = await fetchApi(
      `/api/files?path=${encodeURIComponent(path.join(BRIDGE_HOME, 'nonexistent_xyz_test'))}`,
    );
    expect(status).toBe(404);
  });
});

describe('File download endpoint', () => {
  it('downloads a valid file with correct headers', async () => {
    const res = await fetchRaw(`/api/files/download?path=${encodeURIComponent(path.join(BRIDGE_HOME, 'config.json'))}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('content-disposition')).toMatch(/attachment/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Number(res.headers.get('content-length'))).toBeGreaterThan(0);
  });

  it('rejects directory download with 400', async () => {
    const res = await fetchRaw(`/api/files/download?path=${encodeURIComponent(path.join(BRIDGE_HOME, 'workspaces'))}`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not a file/i);
  });

  it('rejects download without path param', async () => {
    const res = await fetchRaw('/api/files/download');
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent file download', async () => {
    const res = await fetchRaw(`/api/files/download?path=${encodeURIComponent(path.join(BRIDGE_HOME, 'nonexistent_file_test.txt'))}`);
    expect(res.status).toBe(404);
  });
});
