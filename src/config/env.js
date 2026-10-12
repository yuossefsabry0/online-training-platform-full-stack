require('dotenv').config();

const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const int = (name, fallback) => {
  const raw = process.env[name];
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const env = process.env.NODE_ENV || 'development';

// ---- CORS ----
// Allowed origins are configured via CORS_ORIGINS (comma-separated list, no
// spaces around commas). In production this list is mandatory: a missing or
// empty value fails startup rather than silently falling back to unrestricted
// origin access. In development common localhost origins are allowed so the
// API stays usable, plus whatever CORS_ORIGINS adds.
const rawCorsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const DEV_CORS_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

let corsOrigins;
if (env === 'production') {
  if (rawCorsOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGINS must be set to a comma-separated list of allowed origins in production; refusing to start with unrestricted CORS'
    );
  }
  corsOrigins = rawCorsOrigins;
} else {
  corsOrigins = Array.from(new Set([...DEV_CORS_ORIGINS, ...rawCorsOrigins]));
}

// ---- Endpoint rate limiting ----
const MINUTES = 60 * 1000;

const contact = {
  gymPhone: process.env.CONTACT_GYM_PHONE || '+20-100-000-0000',
  gymEmail: process.env.CONTACT_GYM_EMAIL || 'contact@gym.example',
  address: process.env.CONTACT_ADDRESS || '12 Tahrir Square, Cairo',
  hours: process.env.CONTACT_HOURS || '06:00 - 23:00 daily',
};

module.exports = {
  env,
  port: int('PORT', 3000),
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.ACCESS_TOKEN_TTL || '24h',
    refreshTtlSeconds: int('REFRESH_TOKEN_TTL_SECONDS', 86400), 
  },
  mailFrom: process.env.MAIL_FROM || 'gym-api@localhost',
  expiryWarningDays: int('EXPIRY_WARNING_DAYS', 3),
  corsOrigins,
  contact,
  rateLimit: {
    signup: {
      windowMs: int('SIGNUP_RATE_LIMIT_WINDOW_MINUTES', 15) * MINUTES,
      max: int('SIGNUP_RATE_LIMIT_MAX', 10),
    },
    forgotPassword: {
      windowMs: int('FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MINUTES', 15) * MINUTES,
      max: int('FORGOT_PASSWORD_RATE_LIMIT_MAX', 5),
    },
    deleteAccount: {
      windowMs: int('DELETE_ACCOUNT_RATE_LIMIT_WINDOW_MINUTES', 15) * MINUTES,
      max: int('DELETE_ACCOUNT_RATE_LIMIT_MAX', 5),
    },
  },
};
