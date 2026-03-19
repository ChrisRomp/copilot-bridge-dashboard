import { useFetch } from '../hooks/useData.js';
import { getTasks, getTaskHistory } from '../lib/api.js';
import { Loading, ErrorBox, EmptyState, Badge, formatDate } from '../components/Common.js';

export function Tasks() {
  const { data: tasks, loading: tasksLoading, error: tasksError, reload: reloadTasks } = useFetch(getTasks);
  const { data: history, loading: histLoading, error: histError, reload: reloadHistory } = useFetch(
    () => getTaskHistory(20),
  );

  const loading = tasksLoading || histLoading;
  const error = tasksError || histError;

  if (loading) return <Loading message="Loading tasks…" />;
  if (error) return <ErrorBox message={error} onRetry={() => { reloadTasks(); reloadHistory(); }} />;

  return (
    <div>
      <div className="page-header">
        <h1>Scheduled Tasks</h1>
        <p>Recurring and one-off tasks</p>
      </div>

      {/* Tasks table */}
      {!tasks || tasks.length === 0 ? (
        <EmptyState message="No scheduled tasks" />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: 32 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Description</th>
                <th>Bot</th>
                <th>Type</th>
                <th>Schedule</th>
                <th>Timezone</th>
                <th>Enabled</th>
                <th>Last Run</th>
                <th>Next Run</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task: any) => (
                <tr key={task.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{task.id}</td>
                  <td>{task.description ?? '—'}</td>
                  <td>{task.bot_name ?? '—'}</td>
                  <td>
                    <Badge type="info">
                      {task.cron ? 'cron' : 'one-off'}
                    </Badge>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>
                    {task.cron ?? task.run_at ?? '—'}
                  </td>
                  <td>{task.timezone ?? '—'}</td>
                  <td>
                    <Badge type={task.enabled === 1 || task.enabled === true ? 'success' : 'error'}>
                      {task.enabled === 1 || task.enabled === true ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {task.lastRun ?? task.last_run
                      ? formatDate(task.lastRun ?? task.last_run)
                      : '—'}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {task.nextRun ?? task.next_run
                      ? formatDate(task.nextRun ?? task.next_run)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* History */}
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Recent History</h2>
      {!history || history.length === 0 ? (
        <EmptyState message="No task history" />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Fired</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry: any, i: number) => (
                <tr key={entry.id ?? i}>
                  <td>
                    {entry.description ?? entry.task_id ?? '—'}
                  </td>
                  <td>
                    <Badge
                      type={
                        entry.status === 'success'
                          ? 'success'
                          : entry.status === 'error' || entry.status === 'failed'
                            ? 'error'
                            : 'info'
                      }
                    >
                      {entry.status ?? '—'}
                    </Badge>
                  </td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                    {entry.fired_at ? formatDate(entry.fired_at) : '—'}
                  </td>
                  <td
                    style={{
                      fontSize: 13,
                      maxWidth: 300,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--danger, #ef4444)',
                    }}
                  >
                    {entry.error ?? '—'}
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
