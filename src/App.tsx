import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { Overview } from './pages/Overview.js';
import { Platforms } from './pages/Platforms.js';
import { Agents } from './pages/Agents.js';
import { Channels } from './pages/Channels.js';
import { Config } from './pages/Config.js';
import { Files } from './pages/Files.js';
import { Tasks } from './pages/Tasks.js';
import { Logs } from './pages/Logs.js';

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/platforms" element={<Platforms />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/channels" element={<Channels />} />
        <Route path="/config" element={<Config />} />
        <Route path="/files/*" element={<Files />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/logs" element={<Logs />} />
      </Routes>
    </Layout>
  );
}
