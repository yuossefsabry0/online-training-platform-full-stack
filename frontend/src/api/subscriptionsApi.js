import client from './client.js';

// Subscription browsing/selection (all roles, auth required).
// GET /subscriptions/status ->
//   { role, plan: 'MEMBER'|'BASIC', contactUsAccess, subscription|null,
//     expiringSoon, warning? }
//   subscription = { memberId, coach:{coachId,coachNumber,name},
//                    startsAt, expiresAt, remainingDays }
// GET /subscriptions/plans -> per coach:
//   [{ coachId, coachNumber, coachName, specialty, capacity,
//      plans:[{ planId, name, months, priceCents, price }] }]
// POST /subscriptions/confirm { coachNumber, months } ->
//   { mode:'NEW'|'EXTENSION', coach:{coachId,coachNumber,name},
//     plan:{planId,name,months,priceCents} }
// All eligibility/capacity/NEW-vs-EXTENSION rules are decided server-side.

export async function getSubscriptionStatus() {
  const res = await client.get('/subscriptions/status');
  return res.data;
}

export async function listPlans() {
  const res = await client.get('/subscriptions/plans');
  return res.data;
}

export async function confirmSelection({ coachNumber, months }) {
  const res = await client.post('/subscriptions/confirm', {
    coachNumber: Number(coachNumber),
    months: Number(months),
  });
  return res.data;
}
