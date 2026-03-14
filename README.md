# The Bridge Dashboard

A standalone web dashboard for monitoring and managing [copilot-bridge](https://github.com/ChrisRomp/copilot-bridge).

![Dashboard](https://img.shields.io/badge/status-alpha-orange) ![Node](https://img.shields.io/badge/node-%3E%3D20-green)

## Features

- **Overview** — live stats: active sessions, agents, channels, scheduled tasks
- **Platforms** — configured platform adapters and bot accounts
- **Agents** — registered bots with workspace paths and allowed directories
- **Channels** — static and dynamic channel mappings, session history
- **Settings** — bridge defaults, permission rules, inter-agent access, display preferences
- **File Browser** — browse, preview, and upload files within the bridge home directory
  - Syntax highlighting for 20+ languages (highlight.js)
  - Markdown preview with GFM support (tables, task lists, strikethrough)
  - Drag-and-drop file upload
- **Tasks** — scheduled task definitions and execution history
- **Logs** — live-streaming log viewer with filtering and pause/resume

## Quick Start

```bash
# Install dependencies
npm install

# Development (server on :9800, Vite HMR on :9801)
npm run dev

# Production build
npm run build
node dist/server/index.js
```

The dashboard reads directly from the bridge's config, SQLite database, log file, and workspace directories. No bridge API changes are needed.

## Configuration

The dashboard discovers bridge paths automatically via environment variables:

| Variable | Default | Description |
|---|---|---|
| `COPILOT_BRIDGE_HOME` | `~/.copilot-bridge` | Bridge home directory |
| `BRIDGE_DASH_PORT` | `9800` | Dashboard server port |
| `BRIDGE_DASH_HOST` | `127.0.0.1` | Dashboard bind address |

### Authentication

Set `dashboard.apiKey` in your bridge `config.json` to require an API key:

```json
{
  "dashboard": {
    "apiKey": "your-secret-key"
  }
}
```

When set, the dashboard shows a login page. Sessions are maintained via cookies.

## Architecture

```
the-bridge/
├── server/           # Express 5 backend
│   ├── index.ts      # Server entry, middleware, rate limiting
│   ├── routes/api.ts # REST endpoints
│   ├── ws/live.ts    # WebSocket for live updates
│   ├── auth.ts       # Optional API key auth
│   ├── config.ts     # Bridge config reader (tokens sanitized)
│   ├── db.ts         # Read-only SQLite connector
│   ├── files.ts      # File browser with path safety checks
│   └── paths.ts      # Centralized path configuration
├── src/              # React 19 frontend
│   ├── pages/        # 8 page components
│   ├── components/   # Shared UI (CodeViewer, Layout, Common)
│   ├── hooks/        # useFetch, useWebSocket (auto-reconnect)
│   └── lib/api.ts    # API client
└── dist/             # Production build output
    ├── server/       # Compiled server
    └── client/       # Vite-built SPA
```

### Security

- **Path traversal protection** — file API uses `fs.realpathSync(path.resolve(ROOT, input))` + `startsWith(ROOT)` to prevent directory escape (including symlink resolution)
- **Rate limiting** — global (300 req/min), API (120 req/min), login (15 req/15min)
- **CORS** — restricted to localhost origins
- **WebSocket auth** — validates session cookies on connection
- **Token sanitization** — API keys and bot tokens are stripped from config responses
- **Upload safety** — filenames sanitized with `path.basename()`, 50MB limit

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server + Vite HMR |
| `npm run build` | TypeScript compile + Vite production build |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run all tests |
| `npm run test:unit` | Unit tests only (path safety) |
| `npm run test:api` | Integration tests (requires running server) |

## Tech Stack

- **Server**: Express 5, better-sqlite3, ws, chokidar, multer
- **Client**: React 19, TypeScript, Vite 6, react-router-dom
- **Syntax**: highlight.js (20+ languages)
- **Markdown**: react-markdown + remark-gfm
- **Theme**: Dark mode only

## License

MIT
