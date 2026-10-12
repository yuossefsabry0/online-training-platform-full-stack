import client from './client.js';

// Self-service account endpoints (auth required).
// PATCH /auth/profile { nickname } (strict: nickname ONLY) -> updated user
// DELETE /auth/account -> archive (backend enforces: BASIC role, no active
//   subscription, no pending payment)
// GET /contact/ (MEMBER role + active subscription enforced server-side) ->
//   { gymPhone, gymEmail, address, hours, memberId }
// GET /admin/members/:userId/history -> subscription history entries
//   [{ id, coachId, coachName, planName, months, startedAt, endedAt,
//      endReason }]
// LIMITATION (backend read-only, cannot fix): the history route guard is
// requireRole('ADMIN'), so BASIC/MEMBER callers receive 403
// INSUFFICIENT_ROLE even for their OWN id, although the service layer would
// allow self-access. The page surfaces the backend error honestly.

export async function updateNickname(nickname) {
  const res = await client.patch('/auth/profile', { nickname });
  return res.data;
}

export async function deleteOwnAccount() {
  const res = await client.delete('/auth/account');
  return res.data;
}

export async function getContactInfo() {
  const res = await client.get('/contact/');
  return res.data;
}

export async function getMyHistory(userId) {
  const res = await client.get(
    `/admin/members/${encodeURIComponent(userId)}/history`
  );
  return res.data;
}
