import client from './client.js';

// Coach (ADMIN) endpoints. The backend scopes every call to the logged-in
// coach's OWN members/requests server-side — the frontend never filters
// ownership itself.
// GET /members/?page=&pageSize= -> { pagination:{page,pageSize,total,totalPages},
//   items:[{userId,email,username,nickname,memberId,startsAt,expiresAt,remainingDays}] }
// POST /members/:userId/extend {months 1..36} -> {expiresAt,message}
// POST /members/:userId/change-plan {months in 1,3,6,12} -> {expiresAt,message}
// POST /members/:userId/reduce {days 1..1095} -> {ended,expiresAt?,message}
//   (reduce to zero triggers full expiration server-side)
// POST /members/:userId/cancel {} -> {data:null,message}
// GET /payments/?page=&pageSize= -> { pagination, items:[{id,packageName,
//   amountCents,amount,reference,holderName,status,isExtension,decidedAt,
//   rejectionNote,coach:{id,coachNumber,name},user:{id,username,email,role}}] }
// PATCH /payments/:id/decide {action:'approve'|'reject',note?} -> {id,status}
//   (backend re-checks capacity, one-coach conflicts and request state)
// GET /admin/members/:userId/history -> [{id,coachId,coachName,planName,
//   months,startedAt,endedAt,endReason}] (own members only, server-enforced)
// NOTE: no single-member, single-payment, stats or search endpoints exist —
// pages compose these calls and label derived displays honestly.

export async function listMyMembers({ page = 1, pageSize = 10 } = {}) {
  const res = await client.get('/members/', { params: { page, pageSize } });
  return res.data;
}

export async function extendMember(userId, months) {
  const res = await client.post(
    `/members/${encodeURIComponent(userId)}/extend`,
    { months: Number(months) }
  );
  return res.data;
}

export async function changeMemberPlan(userId, months) {
  const res = await client.post(
    `/members/${encodeURIComponent(userId)}/change-plan`,
    { months: Number(months) }
  );
  return res.data;
}

export async function reduceMember(userId, days) {
  const res = await client.post(
    `/members/${encodeURIComponent(userId)}/reduce`,
    { days: Number(days) }
  );
  return res.data;
}

export async function cancelMember(userId) {
  const res = await client.post(
    `/members/${encodeURIComponent(userId)}/cancel`,
    {}
  );
  return res.data;
}

export async function listPaymentRequests({ page = 1, pageSize = 10 } = {}) {
  const res = await client.get('/payments/', { params: { page, pageSize } });
  return res.data;
}

export async function decidePayment(paymentId, { action, note }) {
  const res = await client.patch(
    `/payments/${encodeURIComponent(paymentId)}/decide`,
    note ? { action, note } : { action }
  );
  return res.data;
}

export async function getMemberHistory(userId) {
  const res = await client.get(
    `/admin/members/${encodeURIComponent(userId)}/history`
  );
  return res.data;
}
