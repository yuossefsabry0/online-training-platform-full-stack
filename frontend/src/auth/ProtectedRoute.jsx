import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { hasRole } from './roles.js';
import { FullPageLoader } from '../components/ui.jsx';

// UX-only gate. The backend authorizes every protected API request.
export function ProtectedRoute({ children }) {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) return <FullPageLoader label="Checking your session…" />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

// Role-aware UX gate foundation (navigation only, never security).
export function RoleRoute({ allow, children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!hasRole(user, ...allow)) {
    return <Navigate to="/home" replace state={{ from: location.pathname }} />;
  }
  return children;
}

// Coach-area gate: ADMIN (or SUPER_ADMIN, which passes ADMIN gates on the
// backend too). UX navigation only — backend authorization authoritative.
export function CoachRoute({ children }) {
  const { user, isInitializing } = useAuth();
  const location = useLocation();
  if (isInitializing) return <FullPageLoader label="Checking your session…" />;
  if (!hasRole(user, 'ADMIN', 'SUPER_ADMIN')) {
    return <Navigate to="/home" replace state={{ from: location.pathname }} />;
  }
  return children;
}

// Super-admin gate: SUPER_ADMIN only (ADMIN must not enter).
// UX navigation only — backend authorization remains authoritative.
export function SuperAdminRoute({ children }) {
  const { user, isInitializing } = useAuth();
  const location = useLocation();
  if (isInitializing) return <FullPageLoader label="Checking your session…" />;
  if (user?.role !== 'SUPER_ADMIN') {
    return <Navigate to="/home" replace state={{ from: location.pathname }} />;
  }
  return children;
}

// Redirects already-authenticated users away from auth pages.
export function GuestRoute({ children }) {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();
  if (isInitializing) return <FullPageLoader label="Checking your session…" />;
  if (isAuthenticated) {
    const from = location.state?.from || '/home';
    return <Navigate to={from} replace />;
  }
  return children;
}
