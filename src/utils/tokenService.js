'use strict';

// JWT helpers. Access + refresh tokens both carry a jti so logout can blacklist
// them server-side. Refresh tokens additionally carry sid (login session id) and
// iat; refresh is only honoured while the ORIGINAL 24h session window is open.
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/env');

function signToken(payload, secret, expiresIn) {
  return jwt.sign(payload, secret, { expiresIn });
}

function signAccessToken(user) {
  return signToken(
    { sub: user.id, role: user.role, type: 'access', jti: crypto.randomUUID() },
    config.jwt.accessSecret,
    config.jwt.accessTtl
  );
}

// The refresh token itself expires exactly when the session window does
// (24h from login), so a stolen refresh token cannot outlive the session.
function signRefreshToken(user, sessionId) {
  return signToken(
    {
      sub: user.id,
      type: 'refresh',
      sid: sessionId,
      jti: crypto.randomUUID(),
    },
    config.jwt.refreshSecret,
    config.jwt.refreshTtlSeconds // seconds => hard 24h cap from login
  );
}

function verifyToken(token, kind) {
  const secret = kind === 'refresh' ? config.jwt.refreshSecret : config.jwt.accessSecret;
  const payload = jwt.verify(token, secret); // throws on expiry/tamper
  if (payload.type !== kind) {
    const err = new Error('wrong token type');
    err.name = 'JsonWebTokenError';
    throw err;
  }
  return payload;
}

module.exports = { signAccessToken, signRefreshToken, verifyToken, randomSessionId: () => crypto.randomUUID() };