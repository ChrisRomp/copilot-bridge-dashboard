import { useFetch } from '../hooks/useData.js';
import { getPlatforms } from '../lib/api.js';
import { Loading, ErrorBox, EmptyState, Badge } from '../components/Common.js';

export function Platforms() {
  const { data: platforms, loading, error, reload } = useFetch(getPlatforms);

  if (loading) return <Loading message="Loading platforms…" />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!platforms || Object.keys(platforms).length === 0)
    return (
      <div>
        <div className="page-header">
          <h1>Platforms</h1>
          <p>Connected messaging platforms</p>
        </div>
        <EmptyState message="No platforms configured" />
      </div>
    );

  return (
    <div>
      <div className="page-header">
        <h1>Platforms</h1>
        <p>Connected messaging platforms</p>
      </div>
      <div className="card-grid">
        {Object.entries(platforms).map(([name, platform]: [string, any]) => (
          <div key={name} className="card">
            <h3 style={{ marginBottom: 12 }}>{name}</h3>
            {platform.url && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                {platform.url}
              </p>
            )}

            {platform.bots && Object.keys(platform.bots).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <span className="stat-label" style={{ display: 'block', marginBottom: 8 }}>
                  Bots
                </span>
                {Object.entries(platform.bots).map(([botName, bot]: [string, any]) => (
                  <div
                    key={botName}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg)',
                      borderRadius: 8,
                      marginBottom: 6,
                      fontSize: 13,
                    }}
                  >
                    <strong>{botName}</strong>
                    {bot.admin && (
                      <Badge type="info">
                        admin
                      </Badge>
                    )}
                    <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                      {bot.agent && <span>Agent: {bot.agent}</span>}
                      {bot.agent && bot.model && <span> · </span>}
                      {bot.model && <span>Model: {bot.model}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {platform.access_control && (
              <div>
                <span className="stat-label" style={{ display: 'block', marginBottom: 8 }}>
                  Access Control
                </span>
                <div
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg)',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  {platform.access_control.default_policy && (
                    <div>
                      Default:{' '}
                      <Badge
                        type={platform.access_control.default_policy === 'allow' ? 'success' : 'error'}
                      >
                        {platform.access_control.default_policy}
                      </Badge>
                    </div>
                  )}
                  {platform.access_control.allowed_teams && (
                    <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                      Teams: {platform.access_control.allowed_teams.join(', ')}
                    </div>
                  )}
                  {platform.access_control.allowed_roles && (
                    <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                      Roles: {platform.access_control.allowed_roles.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
