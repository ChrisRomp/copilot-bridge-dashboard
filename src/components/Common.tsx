export function Loading({ message = 'Loading...' }: { message?: string }) {
  return <div className="loading">{message}</div>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card" style={{ borderColor: 'var(--error)', textAlign: 'center', padding: 32 }}>
      <p style={{ color: 'var(--error)', marginBottom: 12 }}>⚠ {message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'var(--bg-hover)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 16px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}

export function Badge({ type, children }: { type: 'success' | 'warning' | 'error' | 'info'; children: React.ReactNode }) {
  return <span className={`badge ${type}`}>{children}</span>;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  try {
    const normalized = /[Z+\-]\d{0,4}$/.test(iso) ? iso : iso + 'Z';
    const timeFormat = typeof localStorage !== 'undefined'
      ? localStorage.getItem('bridge-time-format') ?? '12'
      : '12';
    return new Date(normalized).toLocaleString(undefined, {
      hour12: timeFormat === '12',
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function StatusDot({ status }: { status: 'online' | 'warning' | 'offline' }) {
  return <span className={`status-dot ${status}`} />;
}
