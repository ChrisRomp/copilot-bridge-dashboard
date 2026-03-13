import Database from 'better-sqlite3';
import { paths } from './paths.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(paths.stateDb, { readonly: true });
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Channel sessions
export interface ChannelSession {
  channel_id: string;
  session_id: string;
  created_at: string;
}

export function getChannelSessions(): ChannelSession[] {
  return getDb().prepare('SELECT * FROM channel_sessions ORDER BY created_at DESC').all() as ChannelSession[];
}

// Channel prefs
export interface ChannelPrefs {
  channel_id: string;
  model: string | null;
  agent: string | null;
  verbose: number | null;
  trigger_mode: string | null;
  threaded_replies: number | null;
  permission_mode: string | null;
  reasoning_effort: string | null;
  updated_at: string;
}

export function getChannelPrefs(): ChannelPrefs[] {
  return getDb().prepare('SELECT * FROM channel_prefs ORDER BY updated_at DESC').all() as ChannelPrefs[];
}

// Dynamic channels
export interface DynamicChannel {
  channel_id: string;
  platform: string;
  name: string;
  bot: string | null;
  working_directory: string;
  agent: string | null;
  model: string | null;
  trigger_mode: string | null;
  threaded_replies: number | null;
  verbose: number | null;
  is_dm: number;
  created_at: string;
  updated_at: string;
}

export function getDynamicChannels(): DynamicChannel[] {
  return getDb().prepare('SELECT * FROM dynamic_channels ORDER BY updated_at DESC').all() as DynamicChannel[];
}

// Permission rules
export interface PermissionRule {
  id: number;
  scope: string;
  tool: string;
  command_pattern: string;
  action: string;
  created_at: string;
}

export function getPermissionRules(): PermissionRule[] {
  return getDb().prepare('SELECT * FROM permission_rules ORDER BY created_at DESC').all() as PermissionRule[];
}

// Workspace overrides
export interface WorkspaceOverride {
  bot_name: string;
  working_directory: string;
  allow_paths: string;
  created_at: string;
}

export function getWorkspaceOverrides(): WorkspaceOverride[] {
  return getDb().prepare('SELECT * FROM workspace_overrides ORDER BY bot_name').all() as WorkspaceOverride[];
}

// Scheduled tasks
export interface ScheduledTask {
  id: string;
  channel_id: string;
  bot_name: string;
  prompt: string;
  cron_expr: string | null;
  run_at: string | null;
  timezone: string;
  created_by: string | null;
  description: string | null;
  enabled: number;
  last_run: string | null;
  next_run: string | null;
  created_at: string;
}

export function getScheduledTasks(): ScheduledTask[] {
  return getDb().prepare('SELECT * FROM scheduled_tasks ORDER BY created_at DESC').all() as ScheduledTask[];
}

// Scheduled task history
export interface TaskHistory {
  id: number;
  task_id: string;
  channel_id: string;
  prompt: string;
  description: string | null;
  timezone: string;
  status: string;
  fired_at: string;
  error: string | null;
}

export function getTaskHistory(limit = 100): TaskHistory[] {
  return getDb().prepare('SELECT * FROM scheduled_task_history ORDER BY fired_at DESC LIMIT ?').all(limit) as TaskHistory[];
}

// Agent calls
export interface AgentCall {
  id: number;
  caller_bot: string;
  target_bot: string;
  target_agent: string | null;
  message_summary: string | null;
  response_summary: string | null;
  duration_ms: number | null;
  success: number;
  error: string | null;
  chain_id: string | null;
  depth: number;
  created_at: string;
}

export function getAgentCalls(limit = 100): AgentCall[] {
  return getDb().prepare('SELECT * FROM agent_calls ORDER BY created_at DESC LIMIT ?').all(limit) as AgentCall[];
}

// Settings
export function getSetting(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

// Stats summary
export interface DbStats {
  totalSessions: number;
  totalDynamicChannels: number;
  totalPermissionRules: number;
  totalScheduledTasks: number;
  enabledScheduledTasks: number;
  totalAgentCalls: number;
}

export function getStats(): DbStats {
  const d = getDb();
  const count = (sql: string) => (d.prepare(sql).get() as { c: number }).c;
  return {
    totalSessions: count('SELECT COUNT(*) as c FROM channel_sessions'),
    totalDynamicChannels: count('SELECT COUNT(*) as c FROM dynamic_channels'),
    totalPermissionRules: count('SELECT COUNT(*) as c FROM permission_rules'),
    totalScheduledTasks: count('SELECT COUNT(*) as c FROM scheduled_tasks'),
    enabledScheduledTasks: count('SELECT COUNT(*) as c FROM scheduled_tasks WHERE enabled = 1'),
    totalAgentCalls: count('SELECT COUNT(*) as c FROM agent_calls'),
  };
}
