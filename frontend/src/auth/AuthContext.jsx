import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  login as loginRequest,
  signup as signupRequest,
  logoutRequest,
  refreshAccessToken as refreshRequest,
} from '../api/authApi.js';
import {
  saveSession,
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  getSessionExpiresAt,
  setAccessToken,
  setSessionExpiresAt,
  isSessionExpired,
} from './sessionStore.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [sessionExpiresAt, setSessionExpiresAtState] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Restore sessionStorage state on boot. No local token validation —
  // the backend remains authoritative on the next authenticated call.
  useEffect(() => {
    const storedUser = getStoredUser();
    const token = getAccessToken();
    if (storedUser && token && !isSessionExpired()) {
      setUser(storedUser);
      setSessionExpiresAtState(getSessionExpiresAt());
    } else if (storedUser && token && isSessionExpired()) {
      // Try exactly one silent refresh within the backend 24h window.
      const rt = getRefreshToken();
      if (rt) {
        refreshRequest(rt)
          .then((envelope) => {
            const data = envelope?.data || {};
            if (data.accessToken) {
              setAccessToken(data.accessToken);
              if (data.sessionExpiresAt) setSessionExpiresAt(data.sessionExpiresAt);
              setUser(storedUser);
              setSessionExpiresAtState(data.sessionExpiresAt || getSessionExpiresAt());
            } else {
              clearSession();
            }
          })
          .catch(() => clearSession())
          .finally(() => setIsInitializing(false));
        return;
      }
      clearSession();
    } else {
      clearSession();
    }
    setIsInitializing(false);
  }, []);

  // Cross-tab/interceptor signal: backend declared the session over.
  useEffect(() => {
    const onEnded = () => {
      clearSession();
      setUser(null);
      setSessionExpiresAtState(null);
    };
    window.addEventListener('gym:session-ended', onEnded);
    return () => window.removeEventListener('gym:session-ended', onEnded);
  }, []);

  const applyLoginEnvelope = useCallback((envelope) => {
    const data = envelope?.data || {};
    const nextUser = data.user || null;
    saveSession({
      accessToken: data.accessToken || null,
      refreshToken: data.refreshToken || null,
      user: nextUser,
      sessionExpiresAt: data.sessionExpiresAt || null,
    });
    setUser(nextUser);
    setSessionExpiresAtState(data.sessionExpiresAt || null);
    return { user: nextUser, message: envelope?.message };
  }, []);

  const login = useCallback(
    async ({ username, password }) => {
      const envelope = await loginRequest({ username, password });
      return applyLoginEnvelope(envelope);
    },
    [applyLoginEnvelope]
  );

  const register = useCallback(async ({ username, email, password }) => {
    const envelope = await signupRequest({ username, email, password });
    return { user: envelope?.data || null, message: envelope?.message };
  }, []);

  const logout = useCallback(async () => {
    const rt = getRefreshToken();
    try {
      if (getAccessToken()) await logoutRequest(rt || undefined);
    } catch {
      // Server-side revocation best-effort; always clear client state.
    } finally {
      clearSession();
      setUser(null);
      setSessionExpiresAtState(null);
    }
  }, []);

  // Merge server-reported fields (role, nickname, …) into the stored user.
  // Used to reflect backend-driven changes (e.g. MEMBER→BASIC on expiry,
  // nickname updates) without re-login. Backend remains authoritative.
  const patchUser = useCallback((patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      try {
        window.sessionStorage.setItem('gym.user', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: user?.role || null,
      sessionExpiresAt,
      isAuthenticated: Boolean(user && getAccessToken()),
      isInitializing,
      login,
      register,
      logout,
      patchUser,
    }),
    [user, sessionExpiresAt, isInitializing, login, register, logout, patchUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
