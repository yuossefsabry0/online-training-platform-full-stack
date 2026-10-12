'use strict';

const request = require('supertest');
const { getApp, cleanupDb, seedCoach, createUser, signupAndLogin, prisma, uniqueId } = require('./helpers');

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

describe('Health endpoint', () => {
  test('GET /api/health returns service info', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.service).toBe('gym-api');
    expect(typeof res.body.data.uptime).toBe('number');
  });
});

describe('Contact endpoint', () => {
  async function promoteToRole(username, coach, memberId, expiresAt) {
    const member = await prisma.user.findUnique({ where: { username } });
    await prisma.memberProfile.update({
      where: { userId: member.id },
      data: { coachId: coach.coach.id, memberId, expiresAt },
    });
    await prisma.user.update({ where: { id: member.id }, data: { role: 'MEMBER' } });
    return member;
  }

  test('GET /api/contact requires MEMBER role (BASIC -> 403)', async () => {
    const creds = await signupAndLogin({ username: `contact_basic_${uniqueId()}` });

    const res = await request(app)
      .get('/api/contact')
      .set('Authorization', `Bearer ${creds.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  test('GET /api/contact returns contact info for active MEMBER', async () => {
    const coach = await seedCoach({ username: `contact_coach_${uniqueId()}` });
    const creds = await signupAndLogin({ username: `contact_member_${uniqueId()}` });
    await promoteToRole(creds.username, coach, 'M-CONTACT-001', new Date(Date.now() + 86400000));

    const res = await request(app)
      .get('/api/contact')
      .set('Authorization', `Bearer ${creds.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gymPhone).toBeDefined();
    expect(res.body.data.gymEmail).toBeDefined();
    expect(res.body.data.address).toBeDefined();
    expect(res.body.data.hours).toBeDefined();
    expect(res.body.data.memberId).toBe('M-CONTACT-001');
  });

  test('GET /api/contact with expired subscription returns 403 SUBSCRIPTION_INACTIVE', async () => {
    const coach = await seedCoach({ username: `expired_coach_${uniqueId()}` });
    const creds = await signupAndLogin({ username: `contact_expired_${uniqueId()}` });
    await promoteToRole(creds.username, coach, 'M-EXPIRED-001', new Date(Date.now() - 86400000));

    const res = await request(app)
      .get('/api/contact')
      .set('Authorization', `Bearer ${creds.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUBSCRIPTION_INACTIVE');
  });
});

describe('Coach profile endpoint', () => {
  test('returns coach profile for authenticated user', async () => {
    const coach = await seedCoach({ username: `prof_coach_${uniqueId()}` });
    const creds = await signupAndLogin({ username: `prof_viewer_${uniqueId()}` });

    const res = await request(app)
      .get(`/api/coaches/${coach.coach.coachNumber}`)
      .set('Authorization', `Bearer ${creds.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.coachNumber).toBe(coach.coach.coachNumber);
    expect(res.body.data.name).toBe(coach.coach.name);
    expect(res.body.data.specialty).toBeDefined();
  });

  test('returns 404 for nonexistent coach', async () => {
    const creds = await signupAndLogin({ username: `prof_404_${uniqueId()}` });

    const res = await request(app)
      .get('/api/coaches/999999')
      .set('Authorization', `Bearer ${creds.accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('requires authentication', async () => {
    const res = await request(app).get('/api/coaches/1234');

    expect(res.status).toBe(401);
  });
});

describe('Pagination', () => {
  async function seedPaymentsForCoach(seedCoachResult, count) {
    for (let i = 0; i < count; i++) {
      const user = await createUser({ username: `payuser_${uniqueId()}` });
      await prisma.paymentRequest.create({
        data: {
          userId: user.user.id,
          coachId: seedCoachResult.coach.id,
          packageName: '1 Month',
          amountCents: 30000,
          reference: `REF-PAGE-${uniqueId()}`,
          holderName: 'Pagination Tester',
          status: 'PENDING',
        },
      });
    }
  }

  async function loginAsCoach(seedCoachResult) {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: seedCoachResult.user.username, password: seedCoachResult.password });
    return loginRes.body.data.accessToken;
  }

  test('GET /api/payments/?page=1&pageSize=2 returns paginated results', async () => {
    const coach = await seedCoach({ username: `page_coach_${uniqueId()}` });
    await seedPaymentsForCoach(coach, 3);
    const adminToken = await loginAsCoach(coach);

    const res = await request(app)
      .get('/api/payments/?page=1&pageSize=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pagination).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    expect(res.body.data.items).toHaveLength(2);
  });

  test('pagination object exposes page, pageSize, total, totalPages', async () => {
    const coach = await seedCoach({ username: `page_coach2_${uniqueId()}` });
    await seedPaymentsForCoach(coach, 1);
    const adminToken = await loginAsCoach(coach);

    const res = await request(app)
      .get('/api/payments/?page=1&pageSize=5')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pagination).toEqual({
      page: 1,
      pageSize: 5,
      total: 1,
      totalPages: 1,
    });
  });

  test('invalid page parameter returns 400', async () => {
    const coach = await seedCoach({ username: `page_coach3_${uniqueId()}` });
    const adminToken = await loginAsCoach(coach);

    const res = await request(app)
      .get('/api/payments/?page=0')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Standardized response envelopes', () => {
  test('error responses use { status, error: { code, message, statusCode } }', async () => {
    const res = await request(app).get('/api/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.error).toEqual(
      expect.objectContaining({
        code: 'NOT_FOUND',
        message: expect.any(String),
        statusCode: 404,
      })
    );
  });

  test('success responses use { status, data } envelope', async () => {
    const res = await request(app).get('/api/health');

    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
    expect(res.body.error).toBeUndefined();
  });
});