import { useFetch } from '../hooks/useData.js';
import { getChannels } from '../lib/api.js';
import { Loading, ErrorBox, EmptyState, Badge, StatusDot } from '../components/Common.js';

function ChannelTable({ channels }: { channels: any[] }) {
  if (channels.length === 0) return <EmptyState message="None" />;

  return (
    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Platform</th>
            <th>Bot</th>
            <th>Working Directory</th>
            <th>Trigger</th>
            <th>Threaded</th>
            <th>Verbose</th>
            <th>Session</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((ch: any, i: number) => (
            <tr key={ch.id ?? ch.name ?? i}>
              <td><strong>{ch.name ?? ch.id ?? '—'}</strong></td>
              <td>{ch.platform ?? '—'}</td>
              <td>{ch.bot ?? '—'}</td>
              <td style={{ fontFamily: 'monospace', fontSize: 13 }}>
                {ch.workingDirectory ?? ch.working_directory ?? '—'}
              </td>
              <td>
                <Badge type="info">
                  {ch.triggerMode ?? ch.trigger_on ?? 'all'}
                </Badge>
              </td>
              <td>{ch.threadedReplies ?? ch.threaded_replies ? 'Yes' : 'No'}</td>
              <td>{ch.verbose ? 'Yes' : 'No'}</td>
              <td>
                {ch.sessionActive ?? ch.session ? (
                  <StatusDot status="online" />
                ) : (
                  <StatusDot status="offline" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Channels() {
  const { data, loading, error, reload } = useFetch(getChannels);

  if (loading) return <Loading message="Loading channels…" />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const staticChannels = data?.static ?? [];
  const dynamicChannels = data?.dynamic ?? [];

  return (
    <div>
      <div className="page-header">
        <h1>Channels</h1>
        <p>Channel mappings and preferences</p>
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>
        Static Channels
        <span
          title="Channels explicitly defined in config.json"
          style={{ cursor: 'help', color: 'var(--text-muted)', fontSize: 14, marginLeft: 8 }}
        >
          ⓘ
        </span>
      </h2>
      <div style={{ marginBottom: 32 }}>
        <ChannelTable channels={staticChannels} />
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>
        Dynamic Channels
        <span
          title="Channels discovered at runtime (DMs, onboarded projects)"
          style={{ cursor: 'help', color: 'var(--text-muted)', fontSize: 14, marginLeft: 8 }}
        >
          ⓘ
        </span>
      </h2>
      <ChannelTable channels={dynamicChannels} />
    </div>
  );
}
