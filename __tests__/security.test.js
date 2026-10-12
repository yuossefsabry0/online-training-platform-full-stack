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

describe('Input sanitization', () => {
  test('signup strips HTML tags from username', async () => {
    const username = `san_${uniqueId()}`;
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: `<b>${username}</b>`, email: `${username}@test.example`, password: 'ValidPass@123' });

    expect(res.status).toBe(201);
    expect(res.body.data.username).toBe(username);
  });

  test('profile update strips HTML from nickname', async () => {
    const creds = await signupAndLogin({ username: `nick_${uniqueId()}` });

    const res = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${creds.accessToken}`)
      .send({ nickname: '<script>alert(1)</script>Nick' });

    expect(res.status).toBe(200);
    expect(res.body.data.nickname).toBe('alert(1)Nick');
  });

  test('payment submission strips HTML from holderName', async () => {
    const coach = await seedCoach({ username: `holder_coach_${uniqueId()}` });
    const creds = await signupAndLogin({ username: `holder_${uniqueId()}` });
    const reference = `REF-${uniqueId()}`;

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${creds.accessToken}`)
      .send({
        holderName: '<b>Real</b> <i>Holder</i>',
        reference,
        amount: 300,
        packageName: '1 Month',
        coachNumber: coach.coach.coachNumber,
      });

    expect(res.status).toBe(201);

    const payment = await prisma.paymentRequest.findUnique({ where: { reference } });
    expect(payment.holderName).toBe('Real Holder');
  });
});

describe('CORS', () => {
  test('request without Origin header passes through for server-to-server clients', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('valid endpoints respond with consistent success envelope', async () => {
    const res = await request(app).get('/api/health');

    expect(res.body.status).toBe('success');
    expect(res.body.data).toMatchObject({ service: 'gym-api' });
    expect(typeof res.body.data.uptime).toBe('number');
    expect(res.body.error).toBeUndefined();
  });
});

describe('Rate limiting', () => {
  test('health endpoint works as a sanity check that rate limit wiring does not block normal traffic', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('forgot-password endpoint returns proper response format', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: `reset_${uniqueId()}@test.example` });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(typeof res.body.message).toBe('string');
    expect(res.body.message).toMatch(/if.*registered/i);
  });

  test('delete-account rate limiter still allows a normal deletion (200)', async () => {
    const creds = await signupAndLogin({ username: `delrate_${uniqueId()}` });

    const res = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${creds.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  test('locks account after 5 failed login attempts', async () => {
    const username = `lock_${uniqueId()}`;
    await createUser({ username, isVerified: true });

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ username, password: 'WrongPassword!' });
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'WrongPassword!' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('LOGIN_TEMPORARILY_LOCKED');
  });
});