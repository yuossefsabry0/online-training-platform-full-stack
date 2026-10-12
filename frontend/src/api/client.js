import axios from 'axios';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setSessionExpiresAt,
  clearSession,
  isSessionExpired,
} from '../auth/sessionStore.js';
import { getBackendMessage } from './errors.js';

// Base URL defaults to relative `/api` so the Vite dev proxy forwards to the
// backend (no backend CORS change needed). Override with VITE_API_URL for
// deployed environments.
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise = null;

async function tryRefreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.reject(new Error('NO_REFRESH_TOKEN'));

  refreshPromise = axios
    .post(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
    )
    .then((res) => {
      const data = res.data?.data || {};
      if (!data.accessToken) throw new Error('REFRESH_NO_TOKEN');
      setAccessToken(data.accessToken);
      if (data.sessionExpiresAt) setSessionExpiresAt(data.sessionExpiresAt);
      return data.accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

// Attach the sessionStorage access token to every request.
client.interceptors.request.use(
  (config) => {
    if (isSessionExpired()) {
      // Let the request go through without a doomed token; the response
      // interceptor will route to login. Never invent a local session.
      return config;
    }
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// On 401 with an expired token, attempt exactly one refresh within the
// backend's original 24h session window, then retry the original request.
// Terminal session codes clear the session so the app redirects to /login.
const TERMINAL_CODES = new Set([
  'SESSION_ENDED',
  'TOKEN_REVOKED',
  'REFRESH_TOKEN_INVALID',
  'ACCOUNT_NOT_FOUND',
  'ACCOUNT_DELETED',
]);

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;

    if (!error.response) {
      error.friendlyMessage =
        'Cannot reach the server. Check your connection and try again.';
      return Promise.reject(error);
    }

    if (TERMINAL_CODES.has(code)) {
      clearSession();
      if (!original?._authBypass) {
        window.dispatchEvent(new CustomEvent('gym:session-ended'));
      }
      error.friendlyMessage = getBackendMessage(error);
      return Promise.reject(error);
    }

    if (
      status === 401 &&
      (code === 'TOKEN_EXPIRED' || code === 'TOKEN_INVALID') &&
      original &&
      !original._retried &&
      !original._authBypass
    ) {
      original._retried = true;
      try {
        const nextToken = await tryRefreshAccessToken();
        original.headers.Authorization = `Bearer ${nextToken}`;
        return client(original);
      } catch {
        clearSession();
        window.dispatchEvent(new CustomEvent('gym:session-ended'));
      }
    }

    error.friendlyMessage = getBackendMessage(error);
    return Promise.reject(error);
  }
);

export default client;
