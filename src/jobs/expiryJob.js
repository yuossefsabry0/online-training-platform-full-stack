'use strict';

const subService = require('../services/subscriptionService');

const EXPIRY_SWEEP_INTERVAL_MS = 15 * 60 * 1000; 
const WARNING_SWEEP_INTERVAL_MS = 12 * 60 * 60 * 1000; 

let warningLastRunAt = 0;
let timer = null;

async function tick() {
  try {
    const expired = await subService.runExpirySweep();
    if (expired > 0) console.log(`[expiry-job] terminated ${expired} lapsed subscription(s)`);

    if (Date.now() - warningLastRunAt >= WARNING_SWEEP_INTERVAL_MS) {
      const warned = await subService.runWarningSweep();
      warningLastRunAt = Date.now();
      console.log(`[expiry-job] sent ${warned} expiry-warning email(s)`);
    }
  } catch (err) {
    console.error('[expiry-job] sweep failed:', err.message);
  }
}

function startExpiryJob() {
  timer = setInterval(tick, EXPIRY_SWEEP_INTERVAL_MS);
  if (timer.unref) timer.unref();
  setTimeout(tick, 5_000).unref?.();
  console.log('[expiry-job] started (expiry sweep every 15m, warnings every 12h)');
}

module.exports = { startExpiryJob };
