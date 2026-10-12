'use strict';


const prisma = require('../prisma/prismaClient');
const { ApiError } = require('../utils/ApiError');
const config = require('../config/env');

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 15;
const BLOCK_MINUTES = 15;

function since() {
  return new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
}

async function assertNotLocked({ username, ip }) {
  const [byUser, byIp] = await Promise.all([
    prisma.loginAttempt.count({
      where: { username, success: false, createdAt: { gte: since() } },
    }),
    prisma.loginAttempt.count({
      where: { ip, success: false, createdAt: { gte: since() } },
    }),
  ]);
  if (byUser >= MAX_FAILURES || byIp >= MAX_FAILURES) {
    throw ApiError.tooManyRequests(
      `Too many failed login attempts. Account temporarily locked - try again after ${BLOCK_MINUTES} minutes.`,
      'LOGIN_TEMPORARILY_LOCKED',
      { retryAfterMinutes: BLOCK_MINUTES }
    );
  }
}


async function recordFailure({ username, ip, userId = null }) {
  await prisma.loginAttempt.create({ data: { username, ip, success: false, userId } });
}

async function recordSuccess({ username, ip, userId }) {
  await prisma.loginAttempt.create({ data: { username, ip, success: true, userId } });
  await prisma.loginAttempt.deleteMany({
    where: { username, success: false, createdAt: { gte: since() } },
  });
}

module.exports = { assertNotLocked, recordFailure, recordSuccess, MAX_FAILURES };
