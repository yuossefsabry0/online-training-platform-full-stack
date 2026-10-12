'use strict';

const config = require('./config/env');
const { createApp } = require('./app');
const prisma = require('./prisma/prismaClient');
const { startExpiryJob } = require('./jobs/expiryJob');

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`gym-api listening on http://localhost:${config.port} (${config.env})`);
});

startExpiryJob();

// Graceful shutdown. NOTE (Win32): never process.exit() straight after
// server.close() - libuv can assert-crash. Set exitCode and let the loop drain.
async function shutdown(signal) {
  console.log(`\n${signal} received - shutting down gracefully...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
    } catch (err) {
      console.error('Prisma disconnect error:', err.message);
    }
    process.exitCode = 0;
  });
  // Watchdog: if something keeps the loop alive, force-exit after 10s.
  const watchdog = setTimeout(() => {
    console.warn('Graceful shutdown timed out - forcing exit.');
    process.exit(1);
  }, 10_000);
  watchdog.unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
