'use strict';

const request = require('supertest');
const { getApp, cleanupDb, seedCoach, seedSuperAdmin, createUser, signupAndLogin, prisma, uniqueId } = require('./helpers');

let app;

beforeAll(async () => {
  app = getApp();
});

beforeEach(async () => {
  await cleanupDb();
});

afterAll(async () => {
  await cleanupDb();
  await prisma.$disconnect();
});

describe('Authorization', () => {
  describe('authentication failures', () => {
    test('rejects request without Authorization header', async () => {
      const res = await request(app)
        .get('/api/subscriptions/status');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_MISSING');
    });

    test('rejects malformed Authorization header', async () => {
      const res = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', 'InvalidHeader');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_MISSING');
    });

    test('rejects expired token', async () => {
      const jwt = require('jsonwebtoken');
      const config = require('../src/config/env');

      const user = { id: 'fake-id', role: 'BASIC' };
      const expiredToken = jwt.sign(
        { sub: user.id, role: user.role, type: 'access', jti: require('crypto').randomUUID() },
        config.jwt.accessSecret,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });

    test('rejects tampered token', async () => {
      const res = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.tampered');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_INVALID');
    });

    test('rejects token for non-existent user', async () => {
      const jwt = require('jsonwebtoken');
      const crypto = require('crypto');
      const config = require('../src/config/env');

      const token = jwt.sign(
        { sub: 'nonexistent-user-id', role: 'BASIC', type: 'access', jti: crypto.randomUUID() },
        config.jwt.accessSecret,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
    });
  });

  describe('role restrictions', () => {
    test('MEMBER role cannot access SUPER_ADMIN endpoints', async () => {
      const creds = await signupAndLogin({ username: `role_member_${uniqueId()}` });
      const coach = await seedCoach();
      const member = await prisma.user.findUnique({ where: { username: creds.username } });

      await prisma.memberProfile.update({
        where: { userId: member.id },
        data: { coachId: coach.coach.id, memberId: 'M-TEST', expiresAt: new Date(Date.now() + 86400000) },
      });
      await prisma.user.update({ where: { id: member.id }, data: { role: 'MEMBER' } });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: creds.username, password: creds.password });
      const memberToken = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/admin/audit-log')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
    });

    test('BASIC role cannot access MEMBER-only endpoints', async () => {
      const creds = await signupAndLogin({ username: `role_basic_${uniqueId()}` });

      const res = await request(app)
        .get('/api/contact')
        .set('Authorization', `Bearer ${creds.accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
    });

    test('ADMIN can access ADMIN endpoints', async () => {
      const coach = await seedCoach({ username: `coachadm_${uniqueId()}` });
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: coach.user.username, password: coach.password });
      const adminToken = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/payments/')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination).toBeDefined();
    });

    test('ADMIN cannot access SUPER_ADMIN-only endpoints', async () => {
      const coach = await seedCoach({ username: `coachadm2_${uniqueId()}` });
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: coach.user.username, password: coach.password });
      const adminToken = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/admin/audit-log')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    test('SUPER_ADMIN can access ADMIN endpoints (implicit)', async () => {
      const sa = await seedSuperAdmin({ username: `sa_role_${uniqueId()}` });
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: sa.user.username, password: sa.password });
      const saToken = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/payments/')
        .set('Authorization', `Bearer ${saToken}`);

      expect(res.status).toBe(200);
    });

    test('SUPER_ADMIN can access SUPER_ADMIN-only endpoints', async () => {
      const sa = await seedSuperAdmin({ username: `sa_only_${uniqueId()}` });
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: sa.user.username, password: sa.password });
      const saToken = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/admin/audit-log')
        .set('Authorization', `Bearer ${saToken}`);

      expect(res.status).toBe(200);
    });

    test('unauthenticated user cannot access authenticated endpoints', async () => {
      const endpoints = [
        ['GET', '/api/subscriptions/status'],
        ['GET', '/api/subscriptions/plans'],
        ['GET', '/api/coaches/1'],
        ['GET', '/api/payments/'],
      ];

      for (const [method, path] of endpoints) {
        const res = await request(app)[method.toLowerCase()](path);
        expect(res.status).toBe(401);
      }
    });
  });

  describe('404 handling', () => {
    test('returns structured 404 for unknown routes', async () => {
      const res = await request(app)
        .get('/api/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('malformed JSON', () => {
    test('returns 400 for malformed JSON body', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{invalid json');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MALFORMED_JSON');
    });
  });
});
