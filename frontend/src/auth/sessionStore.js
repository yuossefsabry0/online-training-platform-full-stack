// Session persistence contract (per project spec):
// - The 24-hour access token lives ONLY in sessionStorage.
// - Never localStorage. Never another lifetime. The backend is authoritative:
//   sessionExpiresAt mirrors the login/refresh response; expiry is enforced
//   server-side and the client only uses it for UX (countdown, pre-checks).

const KEYS = {
  accessToken: 'gym.accessToken',
  refreshToken: 'gym.refreshToken',
  user: 'gym.user',
  sessionExpiresAt: 'gym.sessionExpiresAt',
  lastPayment: 'gym.lastPayment',
};

function read(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value == null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode etc.) — app still works in-memory
    // for the current page lifetime; backend remains authoritative.
  }
}

export function getAccessToken() {
  return read(KEYS.accessToken);
}

export function getRefreshToken() {
  return read(KEYS.refreshToken);
}

export function getStoredUser() {
  try {
    const raw = read(KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getSessionExpiresAt() {
  return read(KEYS.sessionExpiresAt);
}

export function setAccessToken(token) {
  write(KEYS.accessToken, token);
}

export function setSessionExpiresAt(value) {
  write(KEYS.sessionExpiresAt, value ? String(value) : null);
}

export function saveSession({ accessToken, refreshToken, user, sessionExpiresAt }) {
  setAccessToken(accessToken || null);
  write(KEYS.refreshToken, refreshToken || null);
  write(KEYS.user, user ? JSON.stringify(user) : null);
  setSessionExpiresAt(sessionExpiresAt || null);
}

export function clearSession() {
  try {
    window.sessionStorage.removeItem(KEYS.accessToken);
    window.sessionStorage.removeItem(KEYS.refreshToken);
    window.sessionStorage.removeItem(KEYS.user);
    window.sessionStorage.removeItem(KEYS.sessionExpiresAt);
  } catch {
    // ignore
  }
}

export function isSessionExpired() {
  const raw = getSessionExpiresAt();
  if (!raw) return false; // unknown — let the backend decide
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return false;
  return Date.now() >= t;
}

// Last payment-submission receipt as returned by POST /payments/ (201).
// Ephemeral UX state only: the backend owns the request lifecycle and the
// frontend never invents payment status from it.
// Durability: kept in localStorage (per device) with a sessionStorage
// fallback for receipts saved before this change. NOTE: this applies ONLY
// to the receipt — access/refresh tokens stay in sessionStorage (see above).
// The receipt carries the submitting username so one device never shows
// another user's pending request.
const RECEIPT_KEY = 'gym.lastPayment';

function readLocal(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // ignore (private mode etc.)
  }
}

export function getLastPayment() {
  try {
    const raw = readLocal(RECEIPT_KEY) || read(KEYS.lastPayment);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setLastPayment(receipt) {
  const raw = receipt ? JSON.stringify(receipt) : null;
  writeLocal(RECEIPT_KEY, raw);
  write(KEYS.lastPayment, receipt ? JSON.stringify(receipt) : null);
}
