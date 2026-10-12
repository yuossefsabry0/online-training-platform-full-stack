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

async function submitPaymentAndDecide(coach, memberCreds, action) {
  const reference = `REF-${uniqueId()}`;
  const submitRes = await request(app)
    .post('/api/payments')
    .set('Authorization', `Bearer ${memberCreds.accessToken}`)
    .send({
      holderName: 'AUDIT HOLDER',
      reference,
      amount: 300,
      packageName: '1 Month',
      coachNumber: coach.coach.coachNumber,
    });

  expect(submitRes.status).toBe(201);

  const coachLogin = await loginAs(coach.user.username, coach.password);
  const decideRes = await request(app)
    .patch(`/api/payments/${submitRes.body.data.id}/decide`)
    .set('Authorization', `Bearer ${coachLogin.accessToken}`)
    .send({ action });

  expect(decideRes.status).toBe(200);
  return { submitRes, decideRes, reference };
}

describe('Audit log (SUPER_ADMIN)', () => {
  test('GET /api/admin/audit-log returns paginated audit entries with expected shape', async () => {
    const sa = await seedSuperAdmin({ username: `audit_sa_${uniqueId()}` });
    const coach = await seedCoach({ username: `audit_coach_${uniqueId()}` });
    const member = await createUser({ username: `audit_member_${uniqueId()}`, isVerified: true });

    await prisma.auditLog.create({
      data: {
        actorId: coach.user.id,
        action: 'APPROVE_PAYMENT',
        targetUserId: member.user.id,
        details: JSON.stringify({ requestId: 'seed' }),
      },
    });

    const saLogin = await loginAs(sa.user.username, sa.password);

    const res = await request(app)
      .get('/api/admin/audit-log')
      .set('Authorization', `Bearer ${saLogin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.total).toBe(1);
    expect(res.body.data.items[0]).toMatchObject({
      actor: coach.user.username,
      actorRole: 'ADMIN',
      action: 'APPROVE_PAYMENT',
      targetUser: member.user.username,
      createdAt: expect.any(String),
    });
    expect(res.body.data.items[0].details.requestId).toBe('seed');
  });

  test('audit log is forbidden for ADMIN (403 INSUFFICIENT_ROLE)', async () => {
    const coach = await seedCoach({ username: `audit_admin_${uniqueId()}` });
    const coachLogin = await loginAs(coach.user.username, coach.password);

    const res = await request(app)
      .get('/api/admin/audit-log')
      .set('Authorization', `Bearer ${coachLogin.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  test('audit log is forbidden for BASIC (403 INSUFFICIENT_ROLE)', async () => {
    const creds = await signupAndLogin({ username: `audit_basic_${uniqueId()}` });

    const res = await request(app)
      .get('/api/admin/audit-log')
      .set('Authorization', `Bearer ${creds.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });
});

describe('Audit entries for key actions', () => {
  test('approving a payment creates an APPROVE_PAYMENT audit entry', async () => {
    const coach = await seedCoach({ username: `ent_coach_${uniqueId()}` });
    const member = await signupAndLogin({ username: `ent_member_${uniqueId()}` });

    await submitPaymentAndDecide(coach, member, 'approve');

    const entry = await prisma.auditLog.findFirst({ where: { action: 'APPROVE_PAYMENT' } });
    expect(entry).toBeTruthy();
    expect(entry.actorId).toBe(coach.user.id);
    expect(entry.targetUserId).toBe(member.user.id);
    expect(JSON.parse(entry.details)).toHaveProperty('requestId');
  });

  test('rejecting a payment creates a REJECT_PAYMENT audit entry', async () => {
    const coach = await seedCoach({ username: `rej_coach_${uniqueId()}` });
    const member = await signupAndLogin({ username: `rej_member_${uniqueId()}` });

    await submitPaymentAndDecide(coach, member, 'reject');

    const entry = await prisma.auditLog.findFirst({ where: { action: 'REJECT_PAYMENT' } });
    expect(entry).toBeTruthy();
    expect(entry.actorId).toBe(coach.user.id);
    expect(entry.targetUserId).toBe(member.user.id);
  });

  test('audit details can be JSON or null', async () => {
    const sa = await seedSuperAdmin({ username: `det_sa_${uniqueId()}` });
    const member = await createUser({ username: `det_member_${uniqueId()}`, isVerified: true });

    await prisma.auditLog.create({
      data: {
        actorId: sa.user.id,
        action: 'WITH_JSON',
        targetUserId: member.user.id,
        details: JSON.stringify({ reason: 'ok' }),
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: sa.user.id,
        action: 'WITH_NULL',
        targetUserId: member.user.id,
        details: null,
      },
    });

    const saLogin = await loginAs(sa.user.username, sa.password);
    const res = await request(app)
      .get('/api/admin/audit-log?pageSize=10')
      .set('Authorization', `Bearer ${saLogin.accessToken}`);

    expect(res.status).toBe(200);

    const jsonEntry = res.body.data.items.find((i) => i.action === 'WITH_JSON');
    const nullEntry = res.body.data.items.find((i) => i.action === 'WITH_NULL');

    expect(jsonEntry.details).toEqual({ reason: 'ok' });
    expect(nullEntry.details).toBeNull();
  });
});

describe('Subscription history (admin)', () => {
  async function createEndedMember() {
    const coach = await seedCoach({ username: `hist_coach_${uniqueId()}` });
    const member = await signupAndLogin({ username: `hist_member_${uniqueId()}` });

    await submitPaymentAndDecide(coach, member, 'approve');

    const memberRow = await prisma.user.findUnique({ where: { username: member.username } });
    const coachLogin = await loginAs(coach.user.username, coach.password);
    const cancelRes = await request(app)
      .post(`/api/members/${memberRow.id}/cancel`)
      .set('Authorization', `Bearer ${coachLogin.accessToken}`);

    expect(cancelRes.status).toBe(200);

    const history = await prisma.subscriptionHistory.findFirst({ where: { userId: memberRow.id } });
    expect(history).toBeTruthy();

    return { coach, member, memberRow };
  }

  test('GET /api/admin/members/:userId/history returns history entries', async () => {
    const sa = await seedSuperAdmin({ username: `hist_sa_${uniqueId()}` });
    const { memberRow } = await createEndedMember();
    const saLogin = await loginAs(sa.user.username, sa.password);

    const res = await request(app)
      .get(`/api/admin/members/${memberRow.id}/history`)
      .set('Authorization', `Bearer ${saLogin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toMatchObject({
      id: expect.any(String),
      coachId: expect.any(String),
      coachName: expect.any(String),
      planName: expect.any(String),
      months: expect.any(Number),
      startedAt: expect.any(String),
      endedAt: expect.any(String),
      endReason: 'CANCELLED',
    });
  });

  test('BASIC user cannot view another user history (403)', async () => {
    const { memberRow } = await createEndedMember();
    const other = await createUser({ username: `hist_basic_${uniqueId()}` });
    const otherLogin = await loginAs(other.user.username, other.password);

    const res = await request(app)
      .get(`/api/admin/members/${memberRow.id}/history`)
      .set('Authorization', `Bearer ${otherLogin.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  test('ADMIN can view history of their own members', async () => {
    const { coach, memberRow } = await createEndedMember();
    const coachLogin = await loginAs(coach.user.username, coach.password);

    const res = await request(app)
      .get(`/api/admin/members/${memberRow.id}/history`)
      .set('Authorization', `Bearer ${coachLogin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('SUPER_ADMIN can view any user history', async () => {
    const sa = await seedSuperAdmin({ username: `hist_sa2_${uniqueId()}` });
    const { memberRow } = await createEndedMember();
    const saLogin = await loginAs(sa.user.username, sa.password);

    const res = await request(app)
      .get(`/api/admin/members/${memberRow.id}/history`)
      .set('Authorization', `Bearer ${saLogin.accessToken}`);

    expect(res.status).toBe(200);
  });
});

describe('Deleted accounts (SUPER_ADMIN)', () => {
  async function createDeletedAccount() {
    const original = await createUser({ username: `del_acc_${uniqueId()}`, isVerified: true });
    return prisma.deletedAccount.create({
      data: {
        originalId: original.user.id,
        username: original.user.username,
        email: original.user.email,
        roleAtDeletion: 'BASIC',
      },
    });
  }

  test('GET /api/admin/deleted-accounts returns paginated archived accounts', async () => {
    const sa = await seedSuperAdmin({ username: `del_sa_${uniqueId()}` });
    const archived = await createDeletedAccount();
    const saLogin = await loginAs(sa.user.username, sa.password);

    const res = await request(app)
      .get('/api/admin/deleted-accounts')
      .set('Authorization', `Bearer ${saLogin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pagination.total).toBe(1);
    expect(res.body.data.items[0]).toMatchObject({
      originalId: archived.originalId,
      username: archived.username,
      email: archived.email,
      roleAtDeletion: 'BASIC',
      deletedAt: expect.any(String),
    });
  });

  test('DELETE /api/admin/deleted-accounts/:id removes the archive permanently', async () => {
    const sa = await seedSuperAdmin({ username: `del_sa2_${uniqueId()}` });
    const archived = await createDeletedAccount();
    const saLogin = await loginAs(sa.user.username, sa.password);

    const res = await request(app)
      .delete(`/api/admin/deleted-accounts/${archived.id}`)
      .set('Authorization', `Bearer ${saLogin.accessToken}`);

    expect(res.status).toBe(200);

    const gone = await prisma.deletedAccount.findUnique({ where: { id: archived.id } });
    expect(gone).toBeNull();
  });

  test('DELETE /api/admin/deleted-accounts/:nonexistent returns 404', async () => {
    const sa = await seedSuperAdmin({ username: `del_sa3_${uniqueId()}` });
    const saLogin = await loginAs(sa.user.username, sa.password);

    const res = await request(app)
      .delete('/api/admin/deleted-accounts/nonexistent-id')
      .set('Authorization', `Bearer ${saLogin.accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});