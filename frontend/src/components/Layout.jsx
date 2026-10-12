import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { getNavForRole } from '../auth/roles.js';

export function TopBar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const navigate = useNavigate();

  const items = getNavForRole(user?.role);

  async function handleLogout() {
    setLeaving(true);
    try {
      await logout();
    } finally {
      setLeaving(false);
      setOpen(false);
      navigate('/login', { replace: true });
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" to={isAuthenticated ? '/home' : '/login'}>
          <span className="brand-mark" aria-hidden="true">
            G
          </span>
          IronPulse
        </Link>

        {isAuthenticated && (
          <nav className={`nav-links${open ? ' open' : ''}`} aria-label="Primary">
            {items.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                {i.label}
              </NavLink>
            ))}
          </nav>
        )}

        {isAuthenticated && (
          <button
            className="menu-toggle"
            type="button"
            aria-expanded={open}
            aria-label="Toggle navigation"
            onClick={() => setOpen((v) => !v)}
          >
            ☰
          </button>
        )}

        <div className="topbar-spacer" />

        {isAuthenticated ? (
          <div className="user-chip">
            <span className="hide-mobile">
              {user?.username} · {user?.role}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={handleLogout}
              disabled={leaving}
            >
              {leaving ? 'Leaving…' : 'Logout'}
            </button>
          </div>
        ) : (
          <div className="user-chip">
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </div>
        )}
      </div>
    </header>
  );
}

export function Layout() {
  return (
    <div className="app-shell">
      <TopBar />
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        IronPulse Gym Management Platform · Train harder, track smarter.
      </footer>
    </div>
  );
}
