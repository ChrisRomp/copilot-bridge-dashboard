const API_BASE = '/api';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// Meta
export const getMeta = () => fetchJson<{ bridgeHome: string }>('/meta');

// Cached bridge home — fetched once on first use
let _bridgeHome: string | null = null;
export async function getBridgeHome(): Promise<string> {
  if (_bridgeHome) return _bridgeHome;
  const meta = await getMeta();
  _bridgeHome = meta.bridgeHome;
  return _bridgeHome;
}

// Config
export const getConfig = () => fetchJson<any>('/config');

// Platforms
export const getPlatforms = () => fetchJson<Record<string, any>>('/platforms');

// Agents
export const getAgents = () => fetchJson<any[]>('/agents');

// Channels
export const getChannels = () => fetchJson<{ static: any[]; dynamic: any[] }>('/channels');

// Sessions
export const getSessions = () => fetchJson<any[]>('/sessions');

// Permissions
export const getPermissions = () => fetchJson<{ configRules: any; storedRules: any[] }>('/permissions');

// Stats
export const getStats = () => fetchJson<any>('/stats');

// Tasks
export const getTasks = () => fetchJson<any[]>('/tasks');
export const getTaskHistory = (limit = 100) => fetchJson<any[]>(`/tasks/history?limit=${limit}`);

// Agent calls
export const getAgentCalls = (limit = 100) => fetchJson<any[]>(`/agent-calls?limit=${limit}`);

// Unified recent activity
export const getRecentActivity = (limit = 30) => fetchJson<any[]>(`/activity?limit=${limit}`);

// Files
export const getFiles = (path?: string, showHidden = false) => {
  const params = new URLSearchParams();
  if (path) params.set('path', path);
  if (showHidden) params.set('hidden', '1');
  const qs = params.toString();
  return fetchJson<any>(`/files${qs ? '?' + qs : ''}`);
};

export const getFileDownloadUrl = (path: string) =>
  `${API_BASE}/files/download?path=${encodeURIComponent(path)}`;

// File upload
export async function uploadFiles(files: File[], targetPath?: string): Promise<{ uploaded: { name: string; size: number; path: string }[] }> {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file);
  }
  const params = targetPath ? `?path=${encodeURIComponent(targetPath)}` : '';
  const res = await fetch(`${API_BASE}/files/upload${params}`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}
