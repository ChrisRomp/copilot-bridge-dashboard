import { useFetch } from '../hooks/useData.js';
import { getAgents } from '../lib/api.js';
import { Loading, ErrorBox, EmptyState, Badge, StatusDot } from '../components/Common.js';

export function Agents() {
  const { data: agents, loading, error, reload } = useFetch(getAgents);

  const entries = agents ?? [];

  if (loading) return <Loading message="Loading agents…" />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <div>
      <div className="page-header">
        <h1>Agents</h1>
        <p>Configured bots and agents</p>
      </div>

      {entries.length === 0 ? (
        <EmptyState message="No agents configured" />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Platform</th>
                <th>Agent File</th>
                <th>Model</th>
                <th>Workspace</th>
                <th>Admin</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((agent: any, i: number) => (
                <tr key={`${agent.platform}-${agent.name}-${i}`}>
                  <td><strong>{agent.name ?? '—'}</strong></td>
                  <td>{agent.platform ?? '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>
                    {agent.agent ?? '—'}
                  </td>
                  <td>{agent.model ?? '—'}</td>
                  <td>
                    {agent.workspace ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <StatusDot
                          status={agent.workspaceExists !== false ? 'online' : 'offline'}
                        />
                        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
                          {agent.workspace}
                        </span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {agent.admin ? (
                      <Badge type="success">Yes</Badge>
                    ) : (
                      <Badge type="info">No</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
