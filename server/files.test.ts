import { describe, it, expect } from 'vitest';
import { isPathSafe, safePath } from './files.js';

describe('isPathSafe', () => {
  const root = '/Users/chris/.copilot-bridge';

  it('allows the root path itself', () => {
    expect(isPathSafe('/Users/chris/.copilot-bridge', root)).toBe(true);
  });

  it('allows a direct child', () => {
    expect(isPathSafe('/Users/chris/.copilot-bridge/config.json', root)).toBe(true);
  });

  it('allows a nested path', () => {
    expect(isPathSafe('/Users/chris/.copilot-bridge/workspaces/copilot/AGENTS.md', root)).toBe(true);
  });

  it('rejects a parent directory', () => {
    expect(isPathSafe('/Users/chris', root)).toBe(false);
  });

  it('rejects an unrelated path', () => {
    expect(isPathSafe('/tmp/evil', root)).toBe(false);
  });

  it('rejects the root path', () => {
    expect(isPathSafe('/', root)).toBe(false);
  });

  it('rejects a path that starts with the root as a prefix but is not a child', () => {
    // /Users/chris/.copilot-bridge-evil is NOT inside /Users/chris/.copilot-bridge
    expect(isPathSafe('/Users/chris/.copilot-bridge-evil/secrets', root)).toBe(false);
  });

  it('rejects path traversal with ..', () => {
    expect(isPathSafe('/Users/chris/.copilot-bridge/workspaces/../../.ssh/id_rsa', root)).toBe(false);
  });

  it('rejects path traversal starting inside root', () => {
    expect(isPathSafe('/Users/chris/.copilot-bridge/../.ssh/authorized_keys', root)).toBe(false);
  });

  it('handles double slashes', () => {
    expect(isPathSafe('/Users/chris/.copilot-bridge//config.json', root)).toBe(true);
  });

  it('handles trailing slashes', () => {
    expect(isPathSafe('/Users/chris/.copilot-bridge/', root)).toBe(true);
  });

  it('rejects empty path (resolves to cwd)', () => {
    // Empty string resolves to cwd which is not inside root
    expect(isPathSafe('', root)).toBe(false);
  });

  it('rejects relative path without root prefix', () => {
    expect(isPathSafe('etc/passwd', root)).toBe(false);
  });
});

describe('safePath', () => {
  const root = '/Users/chris/.copilot-bridge';

  it('returns resolved path for valid paths', () => {
    const result = safePath('/Users/chris/.copilot-bridge/config.json', root);
    expect(result).toBeTruthy();
    expect(result).toContain('.copilot-bridge');
  });

  it('returns resolved path for root itself', () => {
    const result = safePath('/Users/chris/.copilot-bridge', root);
    expect(result).toBeTruthy();
  });

  it('returns null for paths outside root', () => {
    expect(safePath('/tmp/evil', root)).toBeNull();
  });

  it('returns null for traversal attacks', () => {
    expect(safePath('/Users/chris/.copilot-bridge/../../etc/passwd', root)).toBeNull();
  });

  it('returns null for empty path', () => {
    expect(safePath('', root)).toBeNull();
  });

  it('returns null for relative path', () => {
    expect(safePath('etc/passwd', root)).toBeNull();
  });

  it('returns null for prefix-spoofing path', () => {
    expect(safePath('/Users/chris/.copilot-bridge-evil/secrets', root)).toBeNull();
  });
});
