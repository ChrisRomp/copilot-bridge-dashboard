import { useCallback } from 'react';
import { useFetch, useWebSocket } from '../hooks/useData.js';
import { getStats } from '../lib/api.js';
import { Loading, ErrorBox, EmptyState } from '../components/Common.js';
import type { WsMessage } from '../hooks/useData.js';

export function Overview() {
  const { data: stats, loading, error, reload } = useFetch(getStats);

  useWebSocket(
    useCallback(
      (msg: WsMessage) => {
        if (msg.type === 'db.changed' || msg.type === 'config.changed') {
          reload();
        }
      },
      [reload],
    ),
  );

  if (loading) return <Loading message="Loading stats…" />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!stats) return <EmptyState message="No data available" />;

  const cards: { label: string; value: number | string }[] = [
    { label: 'Platforms', value: stats.platformCount ?? 0 },
    { label: 'Bots', value: stats.botCount ?? 0 },
    { label: 'Active Sessions', value: stats.totalSessions ?? 0 },
    { label: 'Static Channels', value: stats.staticChannelCount ?? 0 },
    { label: 'Dynamic Channels', value: stats.totalDynamicChannels ?? 0 },
    { label: 'Scheduled Tasks', value: `${stats.enabledScheduledTasks ?? 0} / ${stats.totalScheduledTasks ?? 0}` },
    { label: 'Permission Rules', value: stats.totalPermissionRules ?? 0 },
    { label: 'Agent Calls', value: stats.totalAgentCalls ?? 0 },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Overview</h1>
        <p>Bridge status at a glance</p>
      </div>
      <div className="card-grid">
        {cards.map((c) => (
          <div key={c.label} className="card stat-card">
            <span className="stat-label">{c.label}</span>
            <span className="stat-value">{c.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
