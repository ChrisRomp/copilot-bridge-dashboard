import { NavLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

const navItems = [
  { path: '/', label: 'Overview', icon: '◉' },
  { path: '/platforms', label: 'Platforms', icon: '⬡' },
  { path: '/agents', label: 'Agents', icon: '⬢' },
  { path: '/channels', label: 'Channels', icon: '▤' },
  { path: '/config', label: 'Settings', icon: '⚙' },
  { path: '/files', label: 'Files', icon: '📁' },
  { path: '/tasks', label: 'Tasks', icon: '⏱' },
  { path: '/logs', label: 'Logs', icon: '▸' },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span>⎈</span> The Bridge
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
