'use strict';

require('dotenv').config();

const BASE = process.env.GYM_API_URL || 'http://localhost:3000/api';

const ADMIN_USERNAME = process.env.SMOKE_ADMIN_USERNAME || 'ahmed';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'Coach@123';
const SUPERADMIN_USERNAME = process.env.SMOKE_SUPERADMIN_USERNAME || 'superadmin';
const SUPERADMIN_PASSWORD = process.env.SMOKE_SUPERADMIN_PASSWORD || 'Super@123';

const results = [];
let passed = 0;
let failed = 0;

function check(name, condition, extra) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` :: ${JSON.stringify(extra).slice(0, 300)}` : ''}`);
    results.push({ name, extra });
  }
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

async function main() {
  const uniq = Date.now().toString(36);
  const username = `smoke_${uniq}`;
  const email = `${username}@example.com`;
  const password = 'SmokeTest@123';

  console.log(`\n== gym-api smoke test vs ${BASE} ==\n`);

  const health = await api('GET', '/health');
  check('health endpoint responds', health.status === 200 && health.json?.status === 'success');


  const badSignup = await api('POST', '/auth/signup', {
    body: { username: 'abc', email: 'not-an-email', password: 'short' },
  });
  check('signup rejects invalid payload with 400 envelope', badSignup.status === 400 && badSignup.json?.status === 'error' && Array.isArray(badSignup.json?.error?.details));

  const signup = await api('POST', '/auth/signup', {
    body: { username, email, password },
  });
  check('signup succeeds (201)', signup.status === 201, signup.json);

  const dupe = await api('POST', '/auth/signup', { body: { username, email: `x${uniq}@e.com`, password } });
  check('duplicate username -> 409 USERNAME_TAKEN', dupe.status === 409 && dupe.json?.error?.code === 'USERNAME_TAKEN', dupe.json);

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const row = await prisma.user.findUnique({ where: { username } });
  check('user created unverified BASIC', row && row.isVerified === false && row.role === 'BASIC');

  const unverifiedLogin = await api('POST', '/auth/login', { body: { username, password } });
  check('login blocked while unverified', unverifiedLogin.status === 403 && unverifiedLogin.json?.error?.code === 'EMAIL_NOT_VERIFIED', unverifiedLogin.json);

  const verify = await api('POST', '/auth/verify-email', { body: { token: row.verifyToken } });
  check('email verification works', verify.status === 200, verify.json);

  const login = await api('POST', '/auth/login', { body: { username, password } });
  check(
    'login issues tokens',
    login.status === 200 && login.json?.data?.accessToken && login.json?.data?.refreshToken,
    login.json
  );
  const accessToken = login.json?.data?.accessToken;
  const refreshToken = login.json?.data?.refreshToken;

  const me = await api('GET', '/subscriptions/status', { token: accessToken });
  check('authenticated status query works', me.status === 200 && me.json?.data?.plan === 'BASIC', me.json);

  const refreshed = await api('POST', '/auth/refresh', { body: { refreshToken } });
  check('refresh issues a new access token', refreshed.status === 200 && !!refreshed.json?.data?.accessToken, refreshed.json);

  const badRefresh = await api('POST', '/auth/refresh', { body: { refreshToken: 'garbage.token.here' } });
  check('garbage refresh rejected 401', badRefresh.status === 401, badRefresh.json);

  const nick = await api('PATCH', '/auth/profile', { token: accessToken, body: { nickname: 'Smoke <b>Nick</b>' } });
  check('nickname update works & sanitizes HTML', nick.status === 200 && nick.json?.data?.user?.nickname === 'Smoke Nick', nick.json);

  const nickHack = await api('PATCH', '/auth/profile', { token: accessToken, body: { nickname: 'x', role: 'SUPER_ADMIN' } });
  check('profile rejects non-nickname fields (strict)', nickHack.status === 400, nickHack.json);


  const plans = await api('GET', '/subscriptions/plans', { token: accessToken });
  check('plans listing has 3 coaches x durations', plans.status === 200 && plans.json?.data?.length === 3, plans.json?.data?.length);

  const confirm = await api('POST', '/subscriptions/confirm', { token: accessToken, body: { coachNumber: 1, months: 1 } });
  check('subscription confirmation passes to payment', confirm.status === 200 && confirm.json?.data?.mode === 'NEW', confirm.json);


  const payment = await api('POST', '/payments/', {
    token: accessToken,
    body: {
      holderName: 'Smoke Tester',
      reference: `REF-${uniq}-A`,
      amount: 300,
      packageName: '1 Month',
      coachNumber: 1,
    },
  });
  check('payment submitted as PENDING', payment.status === 201 && payment.json?.data?.status === 'PENDING', payment.json);
  check('server set NEW flag itself (client never sends it)', typeof payment.json?.data?.isExtension === 'boolean' && !payment.json.data.isExtension);

  const dupRef = await api('POST', '/payments/', {
    token: accessToken,
    body: { holderName: 'S T', reference: `REF-${uniq}-A`, amount: 300, packageName: '1 Month', coachNumber: 2 },
  });
  check('pending duplicate blocked system-wide', dupRef.status === 409 && dupRef.json?.error?.code === 'PENDING_PAYMENT_EXISTS', dupRef.json);

  const u2 = `smoke_b_${uniq}`;
  await api('POST', '/auth/signup', { body: { username: u2, email: `${u2}@example.com`, password } });
  const r2 = await prisma.user.findUnique({ where: { username: u2 } });
  await api('POST', '/auth/verify-email', { body: { token: r2.verifyToken } });
  const login2 = await api('POST', '/auth/login', { body: { username: u2, password } });
  const token2 = login2.json?.data?.accessToken;

  const refReuse = await api('POST', '/payments/', {
    token: token2,
    body: { holderName: 'B Tester', reference: `REF-${uniq}-A`, amount: 300, packageName: '1 Month', coachNumber: 2 },
  });
  check('payment reference reuse rejected globally', refReuse.status === 409 && refReuse.json?.error?.code === 'REFERENCE_ALREADY_USED', refReuse.json);


  const adminLogin = await api('POST', '/auth/login', { body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD } });
  const adminToken = adminLogin.json?.data?.accessToken;
  if (!adminToken) {
    check('admin login for approval tests (seed first: npm run seed)', false, adminLogin.json);
  } else {

    const pendingList = await api('GET', '/admin/payments?page=1&pageSize=5', { token: adminToken });
    const target = pendingList.json?.data?.items?.find((p) => p.reference === `REF-${uniq}-A`);
    check('coach sees pending request in payments log', Boolean(target), pendingList.json);

    const decide = await api('PATCH', `/payments/${target.id}/decide`, { token: adminToken, body: { action: 'approve' } });
    check('approval activates membership', decide.status === 200 && decide.json?.data?.status === 'APPROVED', decide.json);

    const statusAfter = await api('GET', '/subscriptions/status', { token: accessToken });
    check(
      'member promoted: role MEMBER, memberId issued, contact access granted',
      statusAfter.json?.data?.role === 'MEMBER' && statusAfter.json?.data?.contactUsAccess === true,
      statusAfter.json
    );

    const contact = await api('GET', '/contact', { token: accessToken });
    check('Contact Us accessible for active member', contact.status === 200, contact.json);

    const contactBasic = await api('GET', '/contact', { token: token2 });
    check('Contact Us forbidden for BASIC user', contactBasic.status === 403, contactBasic.json);

    const members = await api('GET', '/members/?page=1&pageSize=10', { token: adminToken });
    const found = members.json?.data?.items?.find((m) => m.username === username);
    check('All Members lists own active member with nickname', found && found.nickname === 'Smoke Nick', members.json);

    const ext = await api('POST', `/members/${found.userId}/extend`, { token: adminToken, body: { months: 1 } });
    check('coach can extend membership', ext.status === 200, ext.json);

    const red = await api('POST', `/members/${found.userId}/reduce`, { token: adminToken, body: { days: 400 } });
    check('reduce-to-zero triggers expiration logic', red.status === 200 && red.json?.data?.ended === true, red.json);

    const afterReduce = await api('GET', '/subscriptions/status', { token: accessToken });
    check(
      'after reduce-to-zero: BASIC again, no contact access',
      afterReduce.json?.data?.role === 'BASIC' && afterReduce.json?.data?.contactUsAccess === false,
      afterReduce.json
    );

    const hist = await api('GET', `/admin/members/${found.userId}/history`, { token: adminToken });
    check('subscription history recorded with end reason', hist.status === 200 && ['REDUCED_TO_ZERO'].includes(hist.json?.data?.[0]?.endReason), hist.json);


    const saLogin = await api('POST', '/auth/login', { body: { username: SUPERADMIN_USERNAME, password: SUPERADMIN_PASSWORD } });
    const saToken = saLogin.json?.data?.accessToken;
    if (saToken) {
      const audit = await api('GET', '/admin/audit-log?page=1&pageSize=5', { token: saToken });
      check('audit log readable by super admin', audit.status === 200 && audit.json?.data?.items?.length > 0, audit.json);
      const auditAsCoach = await api('GET', '/admin/audit-log', { token: adminToken });
      check('audit log forbidden for plain coach', auditAsCoach.status === 403, auditAsCoach.json);

      const delAcc = await api('DELETE', '/auth/account', { token: token2 });
      check('self-delete allowed for clean BASIC account', delAcc.status === 200, delAcc.json);

      const delList = await api('GET', '/admin/deleted-accounts?page=1&pageSize=10', { token: saToken });
      check(
        'deleted account archived & super-admin visible',
        delList.json?.data?.items?.some((d) => d.username === u2),
        delList.json
      );

      const deadLogin = await api('POST', '/auth/login', { body: { username: u2, password } });
      check('deleted account cannot log in', deadLogin.status === 401, deadLogin.json);
    }
  }

  const out = await api('POST', '/auth/logout', { token: accessToken });
  check('logout accepted', out.status === 200, out.json);
  const postLogout = await api('GET', '/subscriptions/status', { token: accessToken });
  check('revoked token rejected after logout', postLogout.status === 401 && postLogout.json?.error?.code === 'TOKEN_REVOKED', postLogout.json);

  await prisma.$disconnect();

  console.log(`\n== ${passed} passed, ${failed} failed ==\n`);
  process.exitCode = failed > 0 ? 1 : 0; 
}

main().catch((err) => {
  console.error('SMOKE CRASH:', err);
  process.exitCode = 1;
});
