'use strict';

const prisma = require('../src/prisma/prismaClient');
const { createApp } = require('../src/app');
const bcrypt = require('bcryptjs');

let appInstance = null;

function getApp() {
  if (!appInstance) appInstance = createApp();
  return appInstance;
}

let counter = 0;
function uniqueId() {
  counter += 1;
  return `test_${Date.now().toString(36)}_${counter}`;
}

async function cleanupDb() {
  const tables = [
    'revoked_tokens', 'audit_logs', 'login_attempts',
    'deleted_accounts', 'subscription_history', 'subscriptions',
    'payment_requests', 'member_profiles', 'plans', 'coaches', 'users',
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\``);
  }
}

async function seedCoach({ username, email, password, coachNumber, name, specialty, capacity } = {}) {
  const u = username || `coach_${uniqueId()}`;
  const e = email || `${u}@test.example`;
  const p = password || 'TestPass@123';
  const cNum = coachNumber || Math.floor(Math.random() * 9000) + 1000;
  const n = name || `Coach ${u}`;

  const hashed = await bcrypt.hash(p, 10);
  const user = await prisma.user.create({
    data: {
      username: u,
      email: e,
      password: hashed,
      role: 'ADMIN',
      isVerified: true,
    },
  });

  const coach = await prisma.coach.create({
    data: {
      userId: user.id,
      coachNumber: cNum,
      name: n,
      specialty: specialty || 'General',
      capacity: capacity !== undefined ? capacity : 30,
    },
  });

  const durations = [
    { months: 1, name: '1 Month', priceCents: 30000 },
    { months: 3, name: '3 Months', priceCents: 81000 },
    { months: 6, name: '6 Months', priceCents: 150000 },
    { months: 12, name: '1 Year', priceCents: 276000 },
  ];
  for (const d of durations) {
    await prisma.plan.create({
      data: { coachId: coach.id, name: d.name, months: d.months, priceCents: d.priceCents },
    });
  }

  return { user, coach, password: p };
}

async function seedSuperAdmin({ username, email, password } = {}) {
  const u = username || `sa_${uniqueId()}`;
  const e = email || `${u}@test.example`;
  const p = password || 'SuperTest@123';
  const hashed = await bcrypt.hash(p, 10);

  const user = await prisma.user.create({
    data: {
      username: u,
      email: e,
      password: hashed,
      role: 'SUPER_ADMIN',
      isVerified: true,
    },
  });

  return { user, password: p };
}

async function createUser({ username, email, password, role, isVerified } = {}) {
  const u = username || `user_${uniqueId()}`;
  const e = email || `${u}@test.example`;
  const p = password || 'UserPass@123';
  const hashed = await bcrypt.hash(p, 10);

  const user = await prisma.user.create({
    data: {
      username: u,
      email: e,
      password: hashed,
      role: role || 'BASIC',
      isVerified: isVerified !== undefined ? isVerified : true,
    },
  });

  await prisma.memberProfile.create({ data: { userId: user.id } });

  return { user, password: p };
}

async function signupAndLogin(signupData) {
  const app = getApp();
  const supertest = require('supertest');

  const signupBody = {
    username: signupData.username || `user_${uniqueId()}`,
    email: signupData.email || `${uniqueId()}@test.example`,
    password: signupData.password || 'TestPass@123',
  };

  const signupRes = await supertest(app)
    .post('/api/auth/signup')
    .send(signupBody);

  if (signupRes.status !== 201) {
    throw new Error(`Signup failed: ${JSON.stringify(signupRes.body)}`);
  }

  const dbUser = await prisma.user.findUnique({ where: { username: signupBody.username } });
  const verifyRes = await supertest(app)
    .post('/api/auth/verify-email')
    .send({ token: dbUser.verifyToken });

  if (verifyRes.status !== 200) {
    throw new Error(`Verify failed: ${JSON.stringify(verifyRes.body)}`);
  }

  const loginRes = await supertest(app)
    .post('/api/auth/login')
    .send({ username: signupBody.username, password: signupBody.password });

  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
  }

  return {
    username: signupBody.username,
    password: signupBody.password,
    accessToken: loginRes.body.data.accessToken,
    refreshToken: loginRes.body.data.refreshToken,
    user: loginRes.body.data.user,
  };
}

async function loginAs(username, password) {
  const app = getApp();
  const supertest = require('supertest');

  const res = await supertest(app)
    .post('/api/auth/login')
    .send({ username, password });

  if (res.status !== 200) {
    throw new Error(`Login failed for ${username}: ${JSON.stringify(res.body)}`);
  }

  return {
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
    user: res.body.data.user,
  };
}

module.exports = {
  prisma,
  getApp,
  uniqueId,
  cleanupDb,
  seedCoach,
  seedSuperAdmin,
  createUser,
  signupAndLogin,
  loginAs,
};
