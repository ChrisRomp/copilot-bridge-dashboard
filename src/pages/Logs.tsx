import { useState, useRef, useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useData.js';
import { EmptyState } from '../components/Common.js';
import type { WsMessage } from '../hooks/useData.js';

export function Logs() {
  const [lines, setLines] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [paused, setPaused] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Load recent log tail on mount
  useEffect(() => {
    fetch('/api/logs/tail?lines=50')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        if (data.lines && Array.isArray(data.lines)) {
          setLines(data.lines);
        }
      })
      .catch(() => {
        // Endpoint may not exist yet — that's fine
      })
      .finally(() => setInitialLoaded(true));
  }, []);

  useWebSocket(
    useCallback((msg: WsMessage) => {
      if (msg.type === 'log.lines') {
        const raw = msg.data?.lines ?? msg.data;
        const incoming: string[] = typeof raw === 'string'
          ? raw.split('\n').filter((l: string) => l.trim())
          : Array.isArray(raw) ? raw : [String(raw)];
        setLines((prev) => [...prev, ...incoming].slice(-2000));
      }
    }, []),
  );

  // Auto-scroll when not paused
  useEffect(() => {
    if (!pausedRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines]);

  const filteredLines = filter
    ? lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  const buttonStyle: React.CSSProperties = {
    background: 'var(--bg-hover)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    padding: '6px 14px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  };

  return (
    <div>
      <div className="page-header">
        <h1>Logs</h1>
        <p>Live bridge log viewer</p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Filter logs…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            flex: 1,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          onClick={() => setPaused((p) => !p)}
          style={{
            ...buttonStyle,
            background: paused ? 'rgba(251, 191, 36, 0.15)' : 'var(--bg-hover)',
            color: paused ? 'var(--warning)' : 'var(--text)',
          }}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button onClick={() => setLines([])} style={buttonStyle}>
          Clear
        </button>
      </div>

      {/* Log output */}
      <div
        className="card"
        style={{
          padding: 0,
          maxHeight: 'calc(100vh - 220px)',
          overflow: 'auto',
          fontFamily: "'SF Mono', Menlo, Monaco, 'Courier New', monospace",
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        {!initialLoaded ? (
          <EmptyState message="Loading recent logs…" />
        ) : filteredLines.length === 0 ? (
          <EmptyState message={filter ? 'No lines match filter' : 'Waiting for log output…'} />
        ) : (
          <div style={{ padding: '12px 16px' }}>
            {filteredLines.map((line, i) => (
              <pre key={i} style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {line}
              </pre>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
