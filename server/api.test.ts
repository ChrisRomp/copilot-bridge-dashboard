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
