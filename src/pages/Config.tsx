import { useCallback, useState } from 'react';
import { useFetch, useWebSocket } from '../hooks/useData.js';
import { getConfig, getPermissions } from '../lib/api.js';
import { Loading, ErrorBox, EmptyState, Badge } from '../components/Common.js';
import type { WsMessage } from '../hooks/useData.js';

function SettingRow({ label, value, description }: { label: string; value: React.ReactNode; description?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>}
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 13 }}>{value}</div>
    </div>
  );
}

function RuleList({ rules, type }: { rules: string[]; type: 'success' | 'error' | 'info' | 'warning' }) {
  if (!rules || rules.length === 0) return <span style={{ color: 'var(--text-muted)' }}>None</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {rules.map((r) => <Badge key={r} type={type}>{r}</Badge>)}
    </div>
  );
}

function InterAgentAllow({ allow }: { allow: Record<string, any> }) {
  const entries = Object.entries(allow);
  if (entries.length === 0) return <span style={{ color: 'var(--text-muted)' }}>No rules defined</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map(([caller, rule]) => (
        <div key={caller} style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge type="info">{caller}</Badge>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span>
            {Array.isArray(rule.targets)
              ? rule.targets.join(', ')
              : typeof rule === 'object' && rule.targets
                ? String(rule.targets)
                : JSON.stringify(rule)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Config() {
  const { data: config, loading, error, reload } = useFetch(getConfig);
  const { data: perms, loading: permsLoading } = useFetch(getPermissions);
  const [timeFormat, setTimeFormat] = useState(() =>
    localStorage.getItem('bridge-time-format') ?? '12'
  );

  useWebSocket(
    useCallback(
      (msg: WsMessage) => {
        if (msg.type === 'config.changed') {
          reload();
        }
      },
      [reload],
    ),
  );

  if (loading || permsLoading) return <Loading message="Loading settings…" />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!config) return <EmptyState message="No configuration data" />;

  const defaults = config.defaults ?? {};
  const permissions = config.permissions ?? {};
  const interAgent = config.interAgent ?? {};

  function handleTimeFormatChange(fmt: string) {
    localStorage.setItem('bridge-time-format', fmt);
    setTimeFormat(fmt);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Bridge defaults, permissions, and inter-agent configuration</p>
      </div>

      {/* Display Preferences */}
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Display Preferences</h2>
      <div className="card" style={{ marginBottom: 24, padding: '4px 20px' }}>
        <SettingRow
          label="Time Format"
          description="How timestamps are displayed throughout the dashboard"
          value={
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => handleTimeFormatChange('12')}
                style={{
                  background: timeFormat === '12' ? 'var(--accent)' : 'var(--bg-hover)',
                  color: timeFormat === '12' ? '#fff' : 'var(--text)',
                  border: '1px solid var(--border)', padding: '4px 12px',
                  borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                }}
              >
                12h
              </button>
              <button
                onClick={() => handleTimeFormatChange('24')}
                style={{
                  background: timeFormat === '24' ? 'var(--accent)' : 'var(--bg-hover)',
                  color: timeFormat === '24' ? '#fff' : 'var(--text)',
                  border: '1px solid var(--border)', padding: '4px 12px',
                  borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                }}
              >
                24h
              </button>
            </div>
          }
        />
      </div>

      {/* Defaults */}
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Defaults</h2>
      <div className="card" style={{ marginBottom: 24, padding: '4px 20px' }}>
        <SettingRow label="Model" value={defaults.model ?? '—'} description="Default model for new sessions" />
        <SettingRow label="Agent" value={defaults.agent ?? 'None'} description="Default agent file" />
        <SettingRow label="Trigger Mode" value={<Badge type="info">{defaults.triggerMode ?? 'mention'}</Badge>} description="When the bot responds" />
        <SettingRow label="Threaded Replies" value={defaults.threadedReplies ? '✓ Yes' : '✗ No'} description="Reply in message threads" />
        <SettingRow label="Verbose" value={defaults.verbose ? '✓ Yes' : '✗ No'} description="Show tool calls in chat" />
        <SettingRow label="Permission Mode" value={<Badge type={defaults.permissionMode === 'autopilot' ? 'warning' : 'info'}>{defaults.permissionMode ?? 'interactive'}</Badge>} description="How tool permissions are handled" />
        <SettingRow label="Log Level" value={<Badge type="info">{config.logLevel ?? 'info'}</Badge>} description="Bridge logging verbosity" />
        {defaults.fallbackModels && (
          <SettingRow
            label="Fallback Models"
            value={defaults.fallbackModels.join(' → ')}
            description="Fallback chain when primary model is unavailable"
          />
        )}
      </div>

      {/* Permissions */}
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>
        Permissions
        <span title="Config-level permission rules. Per-tool rules from /remember are stored in the database." style={{ cursor: 'help', color: 'var(--text-muted)', fontSize: 14, marginLeft: 8 }}>ⓘ</span>
      </h2>
      <div className="card" style={{ marginBottom: 24, padding: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Allow</div>
          <RuleList rules={permissions.allow ?? []} type="success" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deny</div>
          <RuleList rules={permissions.deny ?? []} type="error" />
        </div>
        {permissions.allowUrls && permissions.allowUrls.length > 0 && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Allowed URLs</div>
            <RuleList rules={permissions.allowUrls} type="info" />
          </div>
        )}
        {perms?.storedRules && perms.storedRules.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Stored Rules ({perms.storedRules.length})
              <span title="Rules saved via /remember command" style={{ cursor: 'help', marginLeft: 6 }}>ⓘ</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              {perms.storedRules.slice(0, 20).map((rule: any) => (
                <div key={rule.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge type={rule.action === 'allow' ? 'success' : 'error'}>{rule.action}</Badge>
                  <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>{rule.tool}</code>
                  {rule.command_pattern !== '*' && (
                    <span style={{ color: 'var(--text-muted)' }}>pattern: {rule.command_pattern}</span>
                  )}
                  {rule.scope !== 'global' && (
                    <span style={{ color: 'var(--text-muted)' }}>scope: {rule.scope}</span>
                  )}
                </div>
              ))}
              {perms.storedRules.length > 20 && (
                <div style={{ color: 'var(--text-muted)' }}>…and {perms.storedRules.length - 20} more</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Inter-agent */}
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Inter-Agent Communication</h2>
      <div className="card" style={{ padding: '4px 20px' }}>
        <SettingRow label="Enabled" value={interAgent.enabled ? '✓ Yes' : '✗ No'} />
        <SettingRow label="Default Timeout" value={interAgent.defaultTimeout ? `${interAgent.defaultTimeout}s` : '—'} />
        <SettingRow label="Max Timeout" value={interAgent.maxTimeout ? `${interAgent.maxTimeout}s` : '—'} />
        <SettingRow label="Max Depth" value={interAgent.maxDepth ?? '—'} description="Maximum nesting depth for agent-to-agent calls" />
        {interAgent.allow && (
          <div style={{ padding: '12px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Allow Rules</div>
            <InterAgentAllow allow={interAgent.allow} />
          </div>
        )}
      </div>
    </div>
  );
}
