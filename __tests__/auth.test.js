'use strict';

const request = require('supertest');
const { getApp, cleanupDb, seedCoach, seedSuperAdmin, createUser, signupAndLogin, loginAs, prisma, uniqueId } = require('./helpers');

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

describe('Authentication', () => {
  describe('POST /api/auth/signup', () => {
    test('creates user with BASIC role and unverified status', async () => {
      const username = `signup_${uniqueId()}`;
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ username, email: `${username}@test.example`, password: 'ValidPass@123' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.username).toBe(username);
      expect(res.body.data.role).toBe('BASIC');
      expect(res.body.data.isVerified).toBe(false);
      expect(res.body.message).toMatch(/verification/i);
    });

    test('rejects invalid username (too short)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ username: 'abc', email: 'a@b.com', password: 'ValidPass@123' });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.error.details)).toBe(true);
    });

    test('rejects invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ username: 'validname', email: 'not-an-email', password: 'ValidPass@123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects short password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ username: 'validname', email: 'a@b.com', password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects duplicate username', async () => {
      const username = `dupe_${uniqueId()}`;
      await request(app)
        .post('/api/auth/signup')
        .send({ username, email: `${username}@test.example`, password: 'ValidPass@123' });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ username, email: `other_${uniqueId()}@test.example`, password: 'ValidPass@123' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USERNAME_TAKEN');
    });

    test('rejects duplicate email', async () => {
      const email = `dupemail_${uniqueId()}@test.example`;
      const u1 = `user1_${uniqueId()}`;
      const u2 = `user2_${uniqueId()}`;
      await request(app)
        .post('/api/auth/signup')
        .send({ username: u1, email, password: 'ValidPass@123' });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ username: u2, email, password: 'ValidPass@123' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });

    test('sanitizes HTML from username', async () => {
      const username = `san_${uniqueId()}`;
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ username: `<b>${username}</b>`, email: `${username}@test.example`, password: 'ValidPass@123' });

      expect(res.status).toBe(201);
      expect(res.body.data.username).toBe(username);
    });
  });

  describe('POST /api/auth/verify-email', () => {
    test('verifies email with valid token', async () => {
      const username = `verify_${uniqueId()}`;
      await request(app)
        .post('/api/auth/signup')
        .send({ username, email: `${username}@test.example`, password: 'ValidPass@123' });

      const user = await prisma.user.findUnique({ where: { username } });
      expect(user.isVerified).toBe(false);

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: user.verifyToken });

      expect(res.status).toBe(200);
      expect(res.body.data.user.isVerified).toBe(true);

      const updated = await prisma.user.findUnique({ where: { username } });
      expect(updated.isVerified).toBe(true);
      expect(updated.verifyToken).toBeNull();
    });

    test('token is single-use - second attempt with same token gets 400', async () => {
      const username = `verify2_${uniqueId()}`;
      await request(app)
        .post('/api/auth/signup')
        .send({ username, email: `${username}@test.example`, password: 'ValidPass@123' });

      const user = await prisma.user.findUnique({ where: { username } });

      const firstRes = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: user.verifyToken });

      expect(firstRes.status).toBe(200);

      const updated = await prisma.user.findUnique({ where: { username } });
      expect(updated.verifyToken).toBeNull();
      expect(updated.isVerified).toBe(true);

      const secondRes = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: user.verifyToken });

      expect(secondRes.status).toBe(400);
      expect(secondRes.body.error.code).toBe('INVALID_VERIFICATION_TOKEN');
    });

    test('rejects invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'totally-invalid-token-value' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_VERIFICATION_TOKEN');
    });

    test('GET /api/auth/verify-email works with query token', async () => {
      const username = `verifyget_${uniqueId()}`;
      await request(app)
        .post('/api/auth/signup')
        .send({ username, email: `${username}@test.example`, password: 'ValidPass@123' });

      const user = await prisma.user.findUnique({ where: { username } });

      const res = await request(app)
        .get(`/api/auth/verify-email?token=${user.verifyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.isVerified).toBe(true);
    });
  });

  describe('POST /api/auth/login', () => {
    test('returns access and refresh tokens for verified user', async () => {
      const creds = await signupAndLogin({ username: `login_${uniqueId()}` });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: creds.username, password: creds.password });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.sessionExpiresAt).toBeDefined();
      expect(res.body.data.user.username).toBe(creds.username);
    });

    test('rejects unverified user with 403', async () => {
      const username = `unver_${uniqueId()}`;
      await request(app)
        .post('/api/auth/signup')
        .send({ username, email: `${username}@test.example`, password: 'ValidPass@123' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username, password: 'ValidPass@123' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });

    test('rejects wrong password with 401', async () => {
      const creds = await signupAndLogin({ username: `wrongpw_${uniqueId()}` });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: creds.username, password: 'WrongPassword1!' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('rejects nonexistent username with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent_user_xyz', password: 'Whatever@123' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('rejects deleted account login', async () => {
      const username = `delacc_${uniqueId()}`;
      const userRecord = await createUser({ username, isVerified: true });

      await prisma.deletedAccount.create({
        data: {
          originalId: userRecord.user.id,
          username,
          email: userRecord.user.email,
          roleAtDeletion: 'BASIC',
        },
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username, password: userRecord.password });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('ACCOUNT_DELETED');
    });

    test('validates required fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/refresh', () => {
    test('issues new access token with valid refresh token', async () => {
      const creds = await signupAndLogin({ username: `refresh_${uniqueId()}` });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: creds.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.sessionExpiresAt).toBeDefined();
    });

    test('rejects missing refreshToken', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'garbage.token.here' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('REFRESH_TOKEN_INVALID');
    });

    test('rejects revoked refresh token', async () => {
      const creds = await signupAndLogin({ username: `revrefresh_${uniqueId()}` });

      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${creds.accessToken}`)
        .send({ refreshToken: creds.refreshToken });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: creds.refreshToken });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_REVOKED');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('blacklists access and refresh tokens', async () => {
      const creds = await signupAndLogin({ username: `logout_${uniqueId()}` });

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${creds.accessToken}`)
        .send({ refreshToken: creds.refreshToken });

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toMatch(/logged out/i);

      const statusRes = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', `Bearer ${creds.accessToken}`);

      expect(statusRes.status).toBe(401);
      expect(statusRes.body.error.code).toBe('TOKEN_REVOKED');
    });

    test('requires authentication', async () => {
      const res = await request(app)
        .post('/api/auth/logout');

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/auth/profile', () => {
    test('updates nickname', async () => {
      const creds = await signupAndLogin({ username: `profile_${uniqueId()}` });

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${creds.accessToken}`)
        .send({ nickname: 'NewNick' });

      expect(res.status).toBe(200);
      expect(res.body.data.nickname).toBe('NewNick');
    });

    test('rejects non-nickname fields (strict schema)', async () => {
      const creds = await signupAndLogin({ username: `strict_${uniqueId()}` });

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${creds.accessToken}`)
        .send({ nickname: 'ok', role: 'SUPER_ADMIN' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    test('returns generic message even for nonexistent email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@test.example' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/if.*registered/i);
    });

    test('sets resetToken for existing user', async () => {
      const username = `fp_${uniqueId()}`;
      await createUser({ username, isVerified: true });

      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: `${username}@test.example` });

      const user = await prisma.user.findUnique({ where: { username } });
      expect(user.resetToken).toBeTruthy();
      expect(user.resetExpires).toBeTruthy();
    });

    test('validates email format', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    test('resets password with valid token', async () => {
      const username = `rp_${uniqueId()}`;
      await createUser({ username, isVerified: true });

      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: `${username}@test.example` });

      const user = await prisma.user.findUnique({ where: { username } });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: user.resetToken, newPassword: 'NewPass@1234' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/reset/i);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username, password: 'NewPass@1234' });

      expect(loginRes.status).toBe(200);
    });

    test('rejects invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'invalid-token-value-here', newPassword: 'NewPass@1234' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
    });
  });

  describe('DELETE /api/auth/account', () => {
    test('deletes clean BASIC account', async () => {
      const creds = await signupAndLogin({ username: `del_${uniqueId()}` });

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${creds.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);

      const deleted = await prisma.deletedAccount.findFirst({ where: { username: creds.username } });
      expect(deleted).toBeTruthy();
      expect(deleted.roleAtDeletion).toBe('BASIC');
    });

    test('rejects deletion with active subscription', async () => {
      const creds = await signupAndLogin({ username: `delsub_${uniqueId()}` });
      const coach = await seedCoach();
      const member = await prisma.user.findUnique({ where: { username: creds.username } });

      await prisma.memberProfile.update({
        where: { userId: member.id },
        data: { coachId: coach.coach.id, memberId: 'M-TEST', expiresAt: new Date(Date.now() + 86400000) },
      });
      await prisma.user.update({ where: { id: member.id }, data: { role: 'MEMBER' } });

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${creds.accessToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ACTIVE_SUBSCRIPTION_EXISTS');
    });

    test('rejects deletion with pending payment', async () => {
      const creds = await signupAndLogin({ username: `delpay_${uniqueId()}` });
      const coach = await seedCoach();
      const member = await prisma.user.findUnique({ where: { username: creds.username } });

      await prisma.paymentRequest.create({
        data: {
          userId: member.id,
          coachId: coach.coach.id,
          packageName: '1 Month',
          amountCents: 30000,
          reference: `REF-DEL-${uniqueId()}`,
          holderName: 'Test User',
          status: 'PENDING',
        },
      });

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${creds.accessToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PENDING_PAYMENT_EXISTS');
    });
  });

});
