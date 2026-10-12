'use strict';

const { ApiError } = require('../utils/ApiError');

// Generic in-memory fixed-window rate limiter factory. Each call returns an
// Express middleware with its own independent counter store. Keyed per IP by
// default; pass a `key` fn for finer-grained keys (e.g. per account).
//
// This is intentionally generic and separate from loginRateLimit.js, which
// handles login-attempt lockout exclusively and must not be modified here.

const stores = [];
const CLEANUP_MS = 60_000;

function defaultKey(req) {
  return req.ip || 'unknown';
}

function rateLimit({ windowMs, max, key = defaultKey, message, code = 'RATE_LIMITED' }) {
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error('rateLimit: windowMs must be a positive number');
  }
  if (!Number.isFinite(max) || max <= 0) {
    throw new Error('rateLimit: max must be a positive number');
  }

  const store = new Map();
  stores.push(store);

  return (req, _res, next) => {
    const now = Date.now();
    const k = key(req);
    let entry = store.get(k);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(k, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      return next(
        ApiError.tooManyRequests(message, code, { retryAfterMs: entry.resetAt - now })
      );
    }
    next();
  };
}

// Periodically drop expired windows so memory stays bounded under churn. The
// timer is unref'd so it never keeps the process alive by itself.
setInterval(() => {
  const now = Date.now();
  for (const store of stores) {
    for (const [k, entry] of store.entries()) {
      if (now >= entry.resetAt) store.delete(k);
    }
  }
}, CLEANUP_MS).unref();

module.exports = { rateLimit };
