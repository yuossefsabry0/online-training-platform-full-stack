import client from './client.js';

// Thin wrappers over the EXISTING backend auth contract (read-only).
// POST /auth/signup { username, email, password }
// GET|POST /auth/verify-email { token }
// POST /auth/login { username, password } -> { accessToken, refreshToken, sessionExpiresAt, user }
// POST /auth/forgot-password { email }
// POST /auth/reset-password { token, newPassword }
// POST /auth/refresh { refreshToken } (no Bearer header)
// POST /auth/logout (Bearer required, optional { refreshToken })

export async function signup(payload) {
  const res = await client.post('/auth/signup', payload, {
    _authBypass: true,
  });
  return res.data;
}

export async function verifyEmailGet(token) {
  const res = await client.get('/auth/verify-email', {
    params: { token },
    _authBypass: true,
  });
  return res.data;
}

export async function verifyEmailPost(token) {
  const res = await client.post(
    '/auth/verify-email',
    { token },
    { _authBypass: true }
  );
  return res.data;
}

export async function login(payload) {
  const res = await client.post('/auth/login', payload, {
    _authBypass: true,
  });
  return res.data;
}

export async function forgotPassword(email) {
  const res = await client.post(
    '/auth/forgot-password',
    { email },
    { _authBypass: true }
  );
  return res.data;
}

export async function resetPassword(payload) {
  const res = await client.post('/auth/reset-password', payload, {
    _authBypass: true,
  });
  return res.data;
}

export async function refreshAccessToken(refreshToken) {
  const res = await client.post(
    '/auth/refresh',
    { refreshToken },
    { _authBypass: true }
  );
  return res.data;
}

export async function logoutRequest(refreshToken) {
  const res = await client.post(
    '/auth/logout',
    refreshToken ? { refreshToken } : {}
  );
  return res.data;
}
