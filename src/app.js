'use strict';

const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const { registerRoutes } = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

function corsOptions() {
  const allowed = new Set(config.corsOrigins);
  return {
    origin(origin, cb) {
      // Non-browser / same-origin requests carry no Origin header; let them
      // through (server-to-server and curl are not subject to CORS).
      if (!origin) return cb(null, true);
      if (allowed.has(origin)) return cb(null, true);
      // Disallowed origin: no CORS headers are attached, so the browser
      // blocks the response. Never reflects arbitrary origins.
      return cb(null, false);
    },
  };
}

function createApp() {
  const app = express();

  app.use(cors(corsOptions()));
  app.use(express.json({ limit: '100kb' }));

  registerRoutes(app);

  // 404 -> envelope; then central error pipeline.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
