'use strict';

const request = require('supertest');
const { getApp, cleanupDb, seedCoach, createUser, signupAndLogin, loginAs, prisma, uniqueId } = require('./helpers');

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

describe('Subscriptions', () => {
  describe('GET /api/subscriptions/status', () => {
    test('BASIC user gets plan=BASIC, contactUsAccess=false, subscription=null', async () => {
      const user = await createUser();
      const login = await loginAs(user.user.username, user.password);

      const res = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', `Bearer ${login.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('BASIC');
      expect(res.body.data.plan).toBe('BASIC');
      expect(res.body.data.contactUsAccess).toBe(false);
      expect(res.body.data.subscription).toBeNull();
    });

    test('MEMBER gets active subscription details, remainingDays, contactUsAccess=true', async () => {
      const coach = await seedCoach();
      const user = await createUser();
      const expiresAt = new Date(Date.now() + 30 * 86400000);

      await prisma.memberProfile.update({
        where: { userId: user.user.id },
        data: { coachId: coach.coach.id, memberId: `M-${uniqueId()}`, startsAt: new Date(), expiresAt },
      });
      await prisma.subscription.create({
        data: {
          userId: user.user.id,
          coachId: coach.coach.id,
          planName: '1 Month',
          months: 1,
          startsAt: new Date(),
          expiresAt,
          status: 'ACTIVE',
        },
      });
      await prisma.user.update({ where: { id: user.user.id }, data: { role: 'MEMBER' } });

      const login = await loginAs(user.user.username, user.password);

      const res = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', `Bearer ${login.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('MEMBER');
      expect(res.body.data.plan).toBe('MEMBER');
      expect(res.body.data.contactUsAccess).toBe(true);
      expect(res.body.data.subscription).toBeTruthy();
      expect(res.body.data.subscription.memberId).toBeTruthy();
      expect(typeof res.body.data.subscription.remainingDays).toBe('number');
      expect(res.body.data.subscription.remainingDays).toBeGreaterThan(0);
    });

    test('requires authentication', async () => {
      const res = await request(app)
        .get('/api/subscriptions/status');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/subscriptions/plans', () => {
    test('returns plans for 3+ coaches', async () => {
      await seedCoach();
      await seedCoach();
      await seedCoach();

      const user = await createUser();
      const login = await loginAs(user.user.username, user.password);

      const res = await request(app)
        .get('/api/subscriptions/plans')
        .set('Authorization', `Bearer ${login.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });

    test('each coach has 4 plan durations (1,3,6,12 months)', async () => {
      await seedCoach();

      const user = await createUser();
      const login = await loginAs(user.user.username, user.password);

      const res = await request(app)
        .get('/api/subscriptions/plans')
        .set('Authorization', `Bearer ${login.accessToken}`);

      expect(res.status).toBe(200);
      const months = res.body.data[0].plans.map((p) => p.months);
      expect(months).toEqual(expect.arrayContaining([1, 3, 6, 12]));
      expect(months).toHaveLength(4);
    });

    test('requires authentication', async () => {
      const res = await request(app)
        .get('/api/subscriptions/plans');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/subscriptions/confirm', () => {
    test('valid selection returns mode=NEW for fresh user', async () => {
      const coach = await seedCoach();
      const user = await createUser();
      const login = await loginAs(user.user.username, user.password);

      const res = await request(app)
        .post('/api/subscriptions/confirm')
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send({ coachNumber: coach.coach.coachNumber, months: 3 });

      expect(res.status).toBe(200);
      expect(res.body.data.mode).toBe('NEW');
    });

    test('rejects selection for nonexistent coach (404)', async () => {
      const user = await createUser();
      const login = await loginAs(user.user.username, user.password);

      const res = await request(app)
        .post('/api/subscriptions/confirm')
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send({ coachNumber: 999999, months: 3 });

      expect(res.status).toBe(404);
    });

    test('rejects selection for nonexistent plan months (400 PLAN_NOT_OFFERED)', async () => {
      const coach = await seedCoach();
      const user = await createUser();
      const login = await loginAs(user.user.username, user.password);

      await prisma.plan.deleteMany({ where: { coachId: coach.coach.id, months: 6 } });

      const res = await request(app)
        .post('/api/subscriptions/confirm')
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send({ coachNumber: coach.coach.coachNumber, months: 6 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PLAN_NOT_OFFERED');
    });

    test('rejects different coach when active subscription exists (409)', async () => {
      const coach1 = await seedCoach();
      const coach2 = await seedCoach();
      const user = await createUser();
      const expiresAt = new Date(Date.now() + 30 * 86400000);

      await prisma.memberProfile.update({
        where: { userId: user.user.id },
        data: { coachId: coach1.coach.id, memberId: `M-${uniqueId()}`, startsAt: new Date(), expiresAt },
      });
      await prisma.subscription.create({
        data: {
          userId: user.user.id,
          coachId: coach1.coach.id,
          planName: '1 Month',
          months: 1,
          startsAt: new Date(),
          expiresAt,
          status: 'ACTIVE',
        },
      });
      await prisma.user.update({ where: { id: user.user.id }, data: { role: 'MEMBER' } });

      const login = await loginAs(user.user.username, user.password);

      const res = await request(app)
        .post('/api/subscriptions/confirm')
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send({ coachNumber: coach2.coach.coachNumber, months: 3 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ACTIVE_SUBSCRIPTION_WITH_DIFFERENT_COACH');
    });

    test('allows extension mode for same coach with active subscription', async () => {
      const coach = await seedCoach();
      const user = await createUser();
      const expiresAt = new Date(Date.now() + 30 * 86400000);

      await prisma.memberProfile.update({
        where: { userId: user.user.id },
        data: { coachId: coach.coach.id, memberId: `M-${uniqueId()}`, startsAt: new Date(), expiresAt },
      });
      await prisma.subscription.create({
        data: {
          userId: user.user.id,
          coachId: coach.coach.id,
          planName: '1 Month',
          months: 1,
          startsAt: new Date(),
          expiresAt,
          status: 'ACTIVE',
        },
      });
      await prisma.user.update({ where: { id: user.user.id }, data: { role: 'MEMBER' } });

      const login = await loginAs(user.user.username, user.password);

      const res = await request(app)
        .post('/api/subscriptions/confirm')
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send({ coachNumber: coach.coach.coachNumber, months: 3 });

      expect(res.status).toBe(200);
      expect(res.body.data.mode).toBe('EXTENSION');
    });

    test('requires authentication', async () => {
      const coach = await seedCoach();

      const res = await request(app)
        .post('/api/subscriptions/confirm')
        .send({ coachNumber: coach.coach.coachNumber, months: 3 });

      expect(res.status).toBe(401);
    });
  });
});
