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

function paymentBody(coachNumber, ref) {
  return {
    holderName: 'Test User',
    reference: ref,
    amount: 300,
    packageName: '3 Months',
    coachNumber,
  };
}

describe('Payments', () => {
  describe('POST /api/payments/', () => {
    test('submits payment as PENDING (201)', async () => {
      const coach = await seedCoach();
      const user = await createUser();

      const login = await loginAs(user.user.username, user.password);

      const res = await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send(paymentBody(coach.coach.coachNumber, `REF-${uniqueId()}`));

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PENDING');
    });

    test('server determines isExtension flag (false for new user)', async () => {
      const coach = await seedCoach();
      const user = await createUser();

      const login = await loginAs(user.user.username, user.password);

      const res = await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send(paymentBody(coach.coach.coachNumber, `REF-${uniqueId()}`));

      expect(res.status).toBe(201);
      expect(res.body.data.isExtension).toBe(false);
    });

    test('rejects duplicate pending payment per user (409)', async () => {
      const coach = await seedCoach();
      const user = await createUser();
      const login = await loginAs(user.user.username, user.password);

      await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send(paymentBody(coach.coach.coachNumber, `REF-${uniqueId()}`));

      const res = await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send(paymentBody(coach.coach.coachNumber, `REF-${uniqueId()}`));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PENDING_PAYMENT_EXISTS');
    });

    test('rejects reused reference number across users (409)', async () => {
      const coach = await seedCoach();
      const user1 = await createUser();
      const user2 = await createUser();
      const login1 = await loginAs(user1.user.username, user1.password);
      const login2 = await loginAs(user2.user.username, user2.password);

      const ref = `REF-${uniqueId()}`;

      await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${login1.accessToken}`)
        .send(paymentBody(coach.coach.coachNumber, ref));

      const res = await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${login2.accessToken}`)
        .send(paymentBody(coach.coach.coachNumber, ref));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('REFERENCE_ALREADY_USED');
    });

    test('rejects invalid reference format with spaces (400)', async () => {
      const coach = await seedCoach();
      const user = await createUser();
      const login = await loginAs(user.user.username, user.password);

      const body = paymentBody(coach.coach.coachNumber, `REF WITH SPACES-${uniqueId()}`);

      const res = await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects nonexistent coach (404)', async () => {
      const user = await createUser();
      const login = await loginAs(user.user.username, user.password);

      const res = await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send(paymentBody(999999, `REF-${uniqueId()}`));

      expect(res.status).toBe(404);
    });

    test('validates required fields (400)', async () => {
      const coach = await seedCoach();
      const user = await createUser();
      const login = await loginAs(user.user.username, user.password);

      const res = await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send({ coachNumber: coach.coach.coachNumber });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('requires authentication (401)', async () => {
      const coach = await seedCoach();

      const res = await request(app)
        .post('/api/payments/')
        .send(paymentBody(coach.coach.coachNumber, `REF-${uniqueId()}`));

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/payments/:id/decide', () => {
    test('coach approves payment and activates membership', async () => {
      const coach = await seedCoach();
      const user = await createUser();
      const userLogin = await loginAs(user.user.username, user.password);
      const coachLogin = await loginAs(coach.user.username, coach.password);

      const payRes = await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${userLogin.accessToken}`)
        .send(paymentBody(coach.coach.coachNumber, `REF-${uniqueId()}`));

      const paymentId = payRes.body.data.id;

      const res = await request(app)
        .patch(`/api/payments/${paymentId}/decide`)
        .set('Authorization', `Bearer ${coachLogin.accessToken}`)
        .send({ action: 'approve' });

      expect(res.status).toBe(200);

      const updated = await prisma.user.findUnique({ where: { id: user.user.id } });
      expect(updated.role).toBe('MEMBER');

      const statusRes = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', `Bearer ${userLogin.accessToken}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.contactUsAccess).toBe(true);
      expect(statusRes.body.data.subscription).toBeTruthy();
    });

    test('coach rejects payment with note', async () => {
      const coach = await seedCoach();
      const user = await createUser();
      const userLogin = await loginAs(user.user.username, user.password);
      const coachLogin = await loginAs(coach.user.username, coach.password);

      const payRes = await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${userLogin.accessToken}`)
        .send(paymentBody(coach.coach.coachNumber, `REF-${uniqueId()}`));

      const paymentId = payRes.body.data.id;

      const res = await request(app)
        .patch(`/api/payments/${paymentId}/decide`)
        .set('Authorization', `Bearer ${coachLogin.accessToken}`)
        .send({ action: 'reject', note: 'Insufficient funds' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');

      const stored = await prisma.paymentRequest.findUnique({ where: { id: paymentId } });
      expect(stored.rejectionNote).toBe('Insufficient funds');
    });

    test('rejects decision on already-decided request (409)', async () => {
      const coach = await seedCoach();
      const user = await createUser();
      const userLogin = await loginAs(user.user.username, user.password);
      const coachLogin = await loginAs(coach.user.username, coach.password);

      const payRes = await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${userLogin.accessToken}`)
        .send(paymentBody(coach.coach.coachNumber, `REF-${uniqueId()}`));

      const paymentId = payRes.body.data.id;

      await request(app)
        .patch(`/api/payments/${paymentId}/decide`)
        .set('Authorization', `Bearer ${coachLogin.accessToken}`)
        .send({ action: 'approve' });

      const res = await request(app)
        .patch(`/api/payments/${paymentId}/decide`)
        .set('Authorization', `Bearer ${coachLogin.accessToken}`)
        .send({ action: 'approve' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('REQUEST_ALREADY_DECIDED');
    });

    test('coach cannot decide on another coach payment (403)', async () => {
      const coach1 = await seedCoach();
      const coach2 = await seedCoach();
      const user = await createUser();
      const userLogin = await loginAs(user.user.username, user.password);
      const coach2Login = await loginAs(coach2.user.username, coach2.password);

      const payRes = await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${userLogin.accessToken}`)
        .send(paymentBody(coach1.coach.coachNumber, `REF-${uniqueId()}`));

      const paymentId = payRes.body.data.id;

      const res = await request(app)
        .patch(`/api/payments/${paymentId}/decide`)
        .set('Authorization', `Bearer ${coach2Login.accessToken}`)
        .send({ action: 'approve' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_YOUR_REQUEST');
    });

    test('SUPER_ADMIN can decide any payment', async () => {
      const coach = await seedCoach();
      const sa = await seedSuperAdmin();
      const user = await createUser();
      const userLogin = await loginAs(user.user.username, user.password);
      const saLogin = await loginAs(sa.user.username, sa.password);

      const payRes = await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${userLogin.accessToken}`)
        .send(paymentBody(coach.coach.coachNumber, `REF-${uniqueId()}`));

      const paymentId = payRes.body.data.id;

      const res = await request(app)
        .patch(`/api/payments/${paymentId}/decide`)
        .set('Authorization', `Bearer ${saLogin.accessToken}`)
        .send({ action: 'approve' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
    });

    test('BASIC user cannot decide payments (403)', async () => {
      const coach = await seedCoach();
      const user = await createUser();
      const userLogin = await loginAs(user.user.username, user.password);

      const payRes = await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${userLogin.accessToken}`)
        .send(paymentBody(coach.coach.coachNumber, `REF-${uniqueId()}`));

      const paymentId = payRes.body.data.id;

      const res = await request(app)
        .patch(`/api/payments/${paymentId}/decide`)
        .set('Authorization', `Bearer ${userLogin.accessToken}`)
        .send({ action: 'approve' });

      expect(res.status).toBe(403);
    });

    test('requires ADMIN role (BASIC -> 403)', async () => {
      const coach = await seedCoach();
      const user = await createUser();
      const userLogin = await loginAs(user.user.username, user.password);

      const res = await request(app)
        .patch(`/api/payments/${uniqueId()}/decide`)
        .set('Authorization', `Bearer ${userLogin.accessToken}`)
        .send({ action: 'approve' });

      expect(res.status).toBe(403);
    });
  });

  describe('Capacity behavior', () => {
    test('blocks new subscription when coach is at full capacity (409)', async () => {
      const coach = await seedCoach({ capacity: 1 });
      const existing = await createUser();
      await prisma.memberProfile.update({
        where: { userId: existing.user.id },
        data: { coachId: coach.coach.id, memberId: `M-${uniqueId()}`, expiresAt: new Date(Date.now() + 86400000) },
      });

      const user = await createUser();
      const login = await loginAs(user.user.username, user.password);

      const res = await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send(paymentBody(coach.coach.coachNumber, `REF-${uniqueId()}`));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('COACH_AT_CAPACITY');
    });

    test('unlimited capacity coach (null) accepts any number of subscribers', async () => {
      const coach = await seedCoach({ capacity: null });
      const user1 = await createUser();
      const login1 = await loginAs(user1.user.username, user1.password);

      const res1 = await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${login1.accessToken}`)
        .send(paymentBody(coach.coach.coachNumber, `REF-${uniqueId()}`));

      expect(res1.status).toBe(201);
    });
  });

  describe('GET /api/payments/', () => {
    test('ADMIN sees only own coach payments (scoped)', async () => {
      const coach1 = await seedCoach();
      const coach2 = await seedCoach();
      const user = await createUser();
      const userLogin = await loginAs(user.user.username, user.password);
      const coach1Login = await loginAs(coach1.user.username, coach1.password);

      await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${userLogin.accessToken}`)
        .send(paymentBody(coach1.coach.coachNumber, `REF-${uniqueId()}`));

      await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${userLogin.accessToken}`)
        .send({ holderName: 'Test', reference: `REF-${uniqueId()}`, amount: 100, packageName: '1 Month', coachNumber: coach2.coach.coachNumber });

      const res = await request(app)
        .get('/api/payments/')
        .set('Authorization', `Bearer ${coach1Login.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
    });

    test('SUPER_ADMIN sees all payments', async () => {
      const coach1 = await seedCoach();
      const coach2 = await seedCoach();
      const sa = await seedSuperAdmin();
      const user = await createUser();
      const userLogin = await loginAs(user.user.username, user.password);
      const saLogin = await loginAs(sa.user.username, sa.password);

      const user2 = await createUser();
      const user2Login = await loginAs(user2.user.username, user2.password);

      await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${userLogin.accessToken}`)
        .send(paymentBody(coach1.coach.coachNumber, `REF-${uniqueId()}`));

      await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${user2Login.accessToken}`)
        .send({ holderName: 'Test', reference: `REF-${uniqueId()}`, amount: 100, packageName: '1 Month', coachNumber: coach2.coach.coachNumber });

      const res = await request(app)
        .get('/api/payments/')
        .set('Authorization', `Bearer ${saLogin.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);
    });

    test('returns paginated results with pagination object', async () => {
      const coach = await seedCoach();
      const sa = await seedSuperAdmin();
      const user1 = await createUser();
      const user2 = await createUser();
      const login1 = await loginAs(user1.user.username, user1.password);
      const login2 = await loginAs(user2.user.username, user2.password);
      const saLogin = await loginAs(sa.user.username, sa.password);

      await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${login1.accessToken}`)
        .send(paymentBody(coach.coach.coachNumber, `REF-${uniqueId()}`));

      await request(app)
        .post('/api/payments/')
        .set('Authorization', `Bearer ${login2.accessToken}`)
        .send(paymentBody(coach.coach.coachNumber, `REF-${uniqueId()}`));

      const res = await request(app)
        .get('/api/payments/?page=1&pageSize=1')
        .set('Authorization', `Bearer ${saLogin.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.total).toBe(2);
      expect(res.body.data.pagination.totalPages).toBe(2);
    });

    test('requires ADMIN role', async () => {
      const user = await createUser();
      const login = await loginAs(user.user.username, user.password);

      const res = await request(app)
        .get('/api/payments/')
        .set('Authorization', `Bearer ${login.accessToken}`);

      expect(res.status).toBe(403);
    });
  });
});
