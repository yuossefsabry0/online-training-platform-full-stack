import client from './client.js';

// SUPER_ADMIN endpoints (all under /admin, SUPER_ADMIN-gated server-side).
// GET /admin/coaches -> [{coachId,coachNumber,name,bio,specialty,capacity}]
// POST /admin/coaches {userId,coachNumber,name,bio?,specialty?,capacity?}
//   (userId = existing ADMIN user's id; backend validates role/not-found)
//   -> 201 coach row
// PATCH /admin/coaches/:id {bio?,specialty?,capacity?} (strict schema)
// DELETE /admin/coaches/:id -> {data:null,message}
//   (refused when active members remain — COACH_HAS_ACTIVE_MEMBERS)
// GET /admin/payments?page=&pageSize= -> {pagination,items:[...]} (ALL
//   requests system-wide for SUPER_ADMIN)
// GET /admin/deleted-accounts?page=&pageSize= -> {pagination,items:[...]}
//   rows: {id,originalId,username,email,roleAtDeletion,deletedAt}
// DELETE /admin/deleted-accounts/:id -> permanent purge
// GET /admin/audit-log?page=&pageSize= -> {pagination,items:[{id,actor,
//   actorRole,action,targetUser,details,createdAt}]}
// The backend owns all rules; the frontend only renders and submits.

export async function listAllCoaches() {
  const res = await client.get('/admin/coaches');
  return res.data;
}

export async function createCoach(payload) {
  const body = {
    userId: payload.userId,
    coachNumber: Number(payload.coachNumber),
    name: payload.name,
  };
  if (payload.bio) body.bio = payload.bio;
  if (payload.specialty) body.specialty = payload.specialty;
  if (payload.capacity !== '' && payload.capacity != null)
    body.capacity = Number(payload.capacity);
  const res = await client.post('/admin/coaches', body);
  return res.data;
}

export async function updateCoach(coachId, patch) {
  const body = {};
  if (patch.bio !== undefined) body.bio = patch.bio;
  if (patch.specialty !== undefined) body.specialty = patch.specialty;
  if (patch.capacity !== undefined) body.capacity = patch.capacity;
  const res = await client.patch(
    `/admin/coaches/${encodeURIComponent(coachId)}`,
    body
  );
  return res.data;
}

export async function removeCoach(coachId) {
  const res = await client.delete(
    `/admin/coaches/${encodeURIComponent(coachId)}`
  );
  return res.data;
}

export async function listAllPayments({ page = 1, pageSize = 10 } = {}) {
  const res = await client.get('/admin/payments', {
    params: { page, pageSize },
  });
  return res.data;
}

export async function listDeletedAccounts({ page = 1, pageSize = 10 } = {}) {
  const res = await client.get('/admin/deleted-accounts', {
    params: { page, pageSize },
  });
  return res.data;
}

export async function purgeDeletedAccount(id) {
  const res = await client.delete(
    `/admin/deleted-accounts/${encodeURIComponent(id)}`
  );
  return res.data;
}

export async function listAuditLog({ page = 1, pageSize = 10 } = {}) {
  const res = await client.get('/admin/audit-log', {
    params: { page, pageSize },
  });
  return res.data;
}
